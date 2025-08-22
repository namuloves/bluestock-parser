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

    // Extract images with improved logic
    const images = new Set();
    
    // Primary image from structured data
    if (productData.image) {
      if (Array.isArray(productData.image)) {
        productData.image.forEach(img => images.add(img));
      } else {
        images.add(productData.image);
      }
    }
    
    // Get images from variants if available
    if (productData.hasVariant) {
      productData.hasVariant.forEach(variant => {
        if (variant.image) {
          images.add(variant.image);
        }
      });
    }
    
    // Extract color code from URL to generate additional images
    const urlMatch = url.match(/color=(\d+)/);
    let colorCode = ''; // Will be extracted from URL or image
    let selectedColorName = '';
    
    if (urlMatch) {
      colorCode = urlMatch[1];
      // Try to find the color name from variants
      if (productData.hasVariant) {
        const matchingVariant = productData.hasVariant.find(v => 
          v.url && v.url.includes(`color=${colorCode}`)
        );
        if (matchingVariant) {
          selectedColorName = matchingVariant.color || '';
          // Use the variant's specific image if available
          if (matchingVariant.image) {
            // Don't clear all images, just prioritize this one
            const variantImage = matchingVariant.image;
            images.clear();
            images.add(variantImage);
          }
        }
      }
    }
    
    // Extract product code from the main image URL or generate it
    let productCode = '';
    const mainImage = Array.from(images)[0];
    if (mainImage) {
      const codeMatch = mainImage.match(/\/([A-Z0-9]+)_\d+_/);
      if (codeMatch) {
        productCode = codeMatch[1];
      }
    }
    
    // If we have a product code and color code, generate multiple angle images
    if (productCode && colorCode) {
      console.log(`🔍 Generating images for product ${productCode} in color ${colorCode}`);
      
      // Clear existing images to avoid duplicates
      images.clear();
      
      // Lululemon typically has 1-6 images per product color
      // The format is usually PRODUCTCODE_COLORCODE_INDEX
      for (let i = 1; i <= 6; i++) {
        const imageUrl = `https://images.lululemon.com/is/image/lululemon/${productCode}_0${colorCode}_${i}`;
        images.add(imageUrl);
      }
      
      // Also add the main image without index
      images.add(`https://images.lululemon.com/is/image/lululemon/${productCode}_0${colorCode}`);
    }
    
    // Convert Set to Array and limit to reasonable number
    product.image_urls = Array.from(images).slice(0, 15);
    
    // Set the selected color
    product.color = selectedColorName || '';

    // Extract size options if available
    const sizes = [];
    if (productData.hasVariant) {
      // Get sizes for the selected color
      productData.hasVariant.forEach(variant => {
        // Check if this variant matches our color
        if (variant.url && variant.url.includes(`color=${colorCode}`)) {
          if (variant.size && !sizes.includes(variant.size)) {
            sizes.push(variant.size);
          }
        }
      });
    }
    
    // If no sizes found for specific color, get all available sizes
    if (sizes.length === 0 && productData.hasVariant) {
      productData.hasVariant.forEach(variant => {
        if (variant.size && !sizes.includes(variant.size)) {
          sizes.push(variant.size);
        }
      });
    }
    
    if (sizes.length > 0) {
      product.available_sizes = sizes;
    }

    // Extract material from structured data if available
    if (productData.material) {
      product.material = productData.material;
    } else {
      // Try to extract from description
      const descText = productData.description || '';
      const materialKeywords = ['Cotton', 'Polyester', 'Nylon', 'Elastane', 'Spandex', 'Wool', 'Lycra', 'Modal', 'Nulu', 'Luon', 'Everlux', 'Swift', 'Warpstreme'];
      const foundMaterials = materialKeywords.filter(mat => 
        descText.toLowerCase().includes(mat.toLowerCase())
      );
      if (foundMaterials.length > 0) {
        product.material = foundMaterials.join(', ');
      }
    }

    console.log(`✅ Lululemon product scraped successfully with ${product.image_urls.length} images`);
    
    return {
      success: true,
      product
    };
    
  } catch (error) {
    console.error('❌ Lululemon scraping error:', error.message);
    
    // If we can't fetch the page, try to extract basic info from URL
    const fallbackProduct = {
      product_name: 'Lululemon Product',
      brand: 'Lululemon',
      description: '',
      vendor_url: url,
      platform: 'lululemon',
      category: 'Apparel',
      image_urls: [],
      color: '',
      available_sizes: []
    };
    
    // Try to extract color code and generate at least some images
    const colorMatch = url.match(/color=(\d+)/);
    if (colorMatch) {
      const colorCode = colorMatch[1];
      // Common Lululemon product codes - we can try a few
      const possibleCodes = ['LW3JCTS', 'LW4BQLS', 'LW3HKQS', 'LW3JQQS'];
      
      possibleCodes.forEach(code => {
        for (let i = 1; i <= 3; i++) {
          fallbackProduct.image_urls.push(
            `https://images.lululemon.com/is/image/lululemon/${code}_${colorCode}_${i}`
          );
        }
      });
    }
    
    return {
      success: false,
      error: error.message || 'Failed to scrape Lululemon product',
      product: fallbackProduct
    };
  }
}

module.exports = { scrapeLululemon };