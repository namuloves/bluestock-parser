const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeLululemon(url) {
  console.log('🍋 Starting Lululemon scraper for:', url);
  
  try {
    // Fetch the page HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Find JSON-LD structured data
    let productData = null;
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const jsonContent = $(elem).html();
        if (!jsonContent) return;
        
        const data = JSON.parse(jsonContent);
        
        // Look for ProductGroup or Product
        if (data['@type'] === 'ProductGroup' || data['@type'] === 'Product') {
          productData = data;
          return false; // Break the loop
        }
      } catch (e) {
        // Continue to next script tag
      }
    });

    if (!productData) {
      console.log('❌ No structured data found on Lululemon page');
      throw new Error('Unable to extract product data from Lululemon');
    }

    console.log('✅ Found Lululemon product data:', productData.name);

    // Extract basic product info
    const product = {
      product_name: productData.name || '',
      brand: 'Lululemon',
      description: productData.description || '',
      vendor_url: url,
      platform: 'lululemon',
      category: productData.category || 'Apparel'
    };

    // Extract price from the first variant or offer
    if (productData.hasVariant && productData.hasVariant.length > 0) {
      const firstVariant = productData.hasVariant[0];
      if (firstVariant.offers && firstVariant.offers[0]) {
        product.original_price = parseFloat(firstVariant.offers[0].price) || 0;
        product.sale_price = product.original_price;
        product.currency = firstVariant.offers[0].priceCurrency || 'USD';
      }
    } else if (productData.offers) {
      // Handle single product (not a group)
      const offer = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
      product.original_price = parseFloat(offer.price) || 0;
      product.sale_price = product.original_price;
      product.currency = offer.priceCurrency || 'USD';
    }

    // Extract images
    const images = [];
    
    // Primary image
    if (productData.image) {
      if (Array.isArray(productData.image)) {
        images.push(...productData.image);
      } else {
        images.push(productData.image);
      }
    }
    
    // Get images from variants if available
    if (productData.hasVariant) {
      productData.hasVariant.forEach(variant => {
        if (variant.image && !images.includes(variant.image)) {
          images.push(variant.image);
        }
      });
    }
    
    // Also try to get images from the page directly
    const pageImages = [];
    
    // Try different image selectors
    $('img[data-testid*="product"]').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src && src.includes('lululemon')) {
        pageImages.push(src);
      }
    });
    
    $('.product-images img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src && src.includes('lululemon')) {
        pageImages.push(src);
      }
    });
    
    // Add page images that aren't already in the list
    pageImages.forEach(img => {
      if (!images.includes(img)) {
        images.push(img);
      }
    });
    
    product.image_urls = images.slice(0, 10); // Limit to 10 images

    // Extract color from URL or variants
    const urlMatch = url.match(/color=(\d+)/);
    if (urlMatch) {
      const colorCode = urlMatch[1];
      // Try to find the color name from variants
      if (productData.hasVariant) {
        const matchingVariant = productData.hasVariant.find(v => 
          v.url && v.url.includes(`color=${colorCode}`)
        );
        if (matchingVariant && matchingVariant.color) {
          product.color = matchingVariant.color;
        }
      }
    }

    // Extract size options if available
    const sizes = [];
    if (productData.hasVariant) {
      productData.hasVariant.forEach(variant => {
        if (variant.size && !sizes.includes(variant.size)) {
          sizes.push(variant.size);
        }
      });
    }
    if (sizes.length > 0) {
      product.available_sizes = sizes;
    }

    // Extract material from description or page - look for fabric composition
    const materialMatch = response.data.match(/(?:Nulu|Luon|Everlux|Swift|Warpstreme|Lycra|Cotton|Polyester|Nylon|Elastane|Spandex)(?:\s+\d+%)?/gi);
    if (materialMatch && materialMatch.length > 0) {
      // Filter out promotional percentages
      const validMaterials = materialMatch.filter(m => 
        !m.toLowerCase().includes('get') && 
        !m.toLowerCase().includes('off') &&
        !m.toLowerCase().includes('for')
      );
      if (validMaterials.length > 0) {
        product.material = validMaterials.join(', ');
      }
    }

    console.log('✅ Lululemon product scraped successfully');
    
    return {
      success: true,
      product
    };
    
  } catch (error) {
    console.error('❌ Lululemon scraping error:', error.message);
    
    return {
      success: false,
      error: error.message || 'Failed to scrape Lululemon product',
      product: null
    };
  }
}

module.exports = { scrapeLululemon };