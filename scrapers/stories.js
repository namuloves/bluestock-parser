const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');
const { scrapeStoriesWithPuppeteer } = require('./stories-puppeteer');

async function scrapeStoriesHTML(url) {
  try {
    console.log('🔍 Fetching Stories.com page directly...');
    
    // Base configuration
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    };
    
    // Get config with proxy if enabled
    const config = getAxiosConfig(url, baseConfig);
    
    // Make request
    const response = await axios.get(url, config);
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract from JSON-LD structured data
    let productData = null;
    let jsonLdData = null;
    
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        
        // Look for Product type
        if (json['@type'] === 'Product') {
          jsonLdData = json;
        }
        // Sometimes it's nested in @graph
        else if (json['@graph']) {
          const product = json['@graph'].find(item => item['@type'] === 'Product');
          if (product) {
            jsonLdData = product;
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e.message);
      }
    });
    
    // Also try to extract data from Next.js __NEXT_DATA__ script
    let nextData = null;
    $('script#__NEXT_DATA__').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json?.props?.pageProps) {
          nextData = json.props.pageProps;
        }
      } catch (e) {
        console.error('Failed to parse NEXT_DATA:', e.message);
      }
    });
    
    if (jsonLdData) {
      // Extract images
      const images = [];
      if (jsonLdData.image) {
        if (Array.isArray(jsonLdData.image)) {
          images.push(...jsonLdData.image.map(img => {
            if (typeof img === 'string') return img;
            if (img.url) return img.url;
            if (img['@id']) return img['@id'];
            return img;
          }));
        } else if (typeof jsonLdData.image === 'string') {
          images.push(jsonLdData.image);
        } else if (jsonLdData.image.url) {
          images.push(jsonLdData.image.url);
        }
      }
      
      // Extract sizes from offers
      const sizes = [];
      let price = 0;
      let originalPrice = null;
      let currency = 'USD';
      let inStock = false;
      
      if (jsonLdData.offers) {
        const offers = Array.isArray(jsonLdData.offers) ? jsonLdData.offers : [jsonLdData.offers];
        
        offers.forEach(offer => {
          // Extract size from offer name or sku
          if (offer.name) {
            const sizeMatch = offer.name.match(/size[:\s]*([A-Z0-9]+)/i);
            if (sizeMatch && !sizes.includes(sizeMatch[1])) {
              sizes.push(sizeMatch[1]);
            }
          }
          
          // Get price info
          if (offer.price && !price) {
            price = parseFloat(offer.price);
            currency = offer.priceCurrency || 'USD';
          }
          
          // Check if there's a higher price (original price)
          if (offer.highPrice) {
            originalPrice = parseFloat(offer.highPrice);
          }
          
          // Check stock
          if (offer.availability?.includes('InStock')) {
            inStock = true;
          }
        });
      }
      
      // Extract color from name or metadata
      const name = jsonLdData.name || '';
      const description = jsonLdData.description || '';
      let color = '';
      
      // Try to extract color from the product name (often after a dash or comma)
      const colorPatterns = [
        /[-–,]\s*([^-–,]+)$/,  // After dash, en-dash, or comma
        /\bin\s+([A-Za-z\s]+)$/i,  // "in [color]"
        /\(([^)]+)\)/  // In parentheses
      ];
      
      for (const pattern of colorPatterns) {
        const match = name.match(pattern);
        if (match) {
          color = match[1].trim();
          break;
        }
      }
      
      // Build the final product object
      productData = {
        name: name,
        price: currency === 'USD' ? `$${price}` : `${price} ${currency}`,
        originalPrice: originalPrice ? (currency === 'USD' ? `$${originalPrice}` : `${originalPrice} ${currency}`) : null,
        images: images,
        description: description,
        sizes: sizes,
        color: color,
        sku: jsonLdData.sku || jsonLdData.productID || '',
        brand: jsonLdData.brand?.name || 'Stories',
        category: jsonLdData.category || '',
        isOnSale: originalPrice && price < originalPrice,
        inStock: inStock,
        url: url
      };
    }
    
    // Try to extract additional data from Next.js data if available
    if (nextData?.product && !productData) {
      const product = nextData.product;
      
      // Extract images
      const images = [];
      if (product.images) {
        product.images.forEach(img => {
          if (img.url) images.push(img.url);
          else if (typeof img === 'string') images.push(img);
        });
      }
      if (product.media) {
        product.media.forEach(media => {
          if (media.type === 'image' && media.url) {
            images.push(media.url);
          }
        });
      }
      
      // Extract sizes
      const sizes = [];
      if (product.variants) {
        product.variants.forEach(variant => {
          if (variant.size && !sizes.includes(variant.size)) {
            sizes.push(variant.size);
          }
        });
      }
      
      // Extract price
      let price = product.price?.amount || product.price || 0;
      let originalPrice = product.compareAtPrice?.amount || product.compareAtPrice || null;
      const currency = product.price?.currencyCode || 'USD';
      
      productData = {
        name: product.name || product.title || '',
        price: currency === 'USD' ? `$${price}` : `${price} ${currency}`,
        originalPrice: originalPrice ? (currency === 'USD' ? `$${originalPrice}` : `${originalPrice} ${currency}`) : null,
        images: images,
        description: product.description || '',
        sizes: sizes,
        color: product.color || product.selectedVariant?.color || '',
        sku: product.sku || product.id || '',
        brand: product.brand || 'Stories',
        category: product.category || product.productType || '',
        isOnSale: originalPrice && price < originalPrice,
        inStock: product.available !== false,
        url: url
      };
    }
    
    // Fallback to HTML parsing if no structured data
    if (!productData) {
      // Try various selectors for product name
      const name = $('h1').first().text().trim() || 
                   $('.product-name').text().trim() ||
                   $('.product-title').text().trim() ||
                   $('[data-testid="product-name"]').text().trim() ||
                   $('meta[property="og:title"]').attr('content') || '';
      
      // Try various selectors for price
      const priceText = $('.price').first().text().trim() || 
                        $('.product-price').text().trim() ||
                        $('[data-testid="product-price"]').text().trim() ||
                        $('.product-price-value').text().trim() ||
                        '';
      
      // Extract original price if on sale
      const originalPriceText = $('.original-price').text().trim() ||
                                $('.compare-at-price').text().trim() ||
                                $('.was-price').text().trim() ||
                                '';
      
      // Extract images
      const images = [];
      
      // From meta tags
      $('meta[property="og:image"]').each((i, elem) => {
        const src = $(elem).attr('content');
        if (src) images.push(src);
      });
      
      // From product images
      $('.product-image img, .product-images img, [data-testid="product-image"] img').each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
      
      // Extract sizes
      const sizes = [];
      $('.size-option, .size-selector option, [data-testid="size-option"]').each((i, elem) => {
        const size = $(elem).text().trim();
        if (size && !sizes.includes(size)) {
          sizes.push(size);
        }
      });
      
      // Extract color
      let color = $('.color-name').text().trim() ||
                  $('.selected-color').text().trim() ||
                  $('[data-testid="color-name"]').text().trim() ||
                  '';
      
      // Try to extract color from title
      if (!color && name) {
        const colorMatch = name.match(/[-–,]\s*([^-–,]+)$/);
        if (colorMatch) {
          color = colorMatch[1].trim();
        }
      }
      
      productData = {
        name: name,
        price: priceText || 'Price not available',
        originalPrice: originalPriceText || null,
        images: images,
        description: $('meta[property="og:description"]').attr('content') || 
                     $('.product-description').text().trim() || '',
        sizes: sizes,
        color: color,
        sku: url.match(/(\d+)$/)?.[1] || '',
        brand: 'Stories',
        category: '',
        isOnSale: !!originalPriceText,
        inStock: !$('.out-of-stock').length && !$('.sold-out').length,
        url: url
      };
    }
    
    // Clean up and ensure all fields have values
    productData.name = productData.name || 'Stories Product';
    productData.brand = productData.brand || 'Stories';
    productData.images = productData.images.filter(img => img && typeof img === 'string');
    
    // Ensure images have full URLs
    productData.images = productData.images.map(img => {
      if (img.startsWith('//')) {
        return 'https:' + img;
      } else if (img.startsWith('/')) {
        return 'https://www.stories.com' + img;
      }
      return img;
    });
    
    return productData;
    
  } catch (error) {
    console.error('Stories HTML scraper error:', error.message);
    
    // If it's a 403 or similar, try Puppeteer
    if (error.response && (error.response.status === 403 || error.response.status === 429)) {
      console.log('⚠️ Stories.com blocked direct request, trying Puppeteer...');
      
      try {
        // Check if puppeteer is available
        try {
          require.resolve('puppeteer');
          return await scrapeStoriesWithPuppeteer(url);
        } catch (puppeteerCheckError) {
          console.log('Puppeteer not available, returning limited data');
        }
      } catch (puppeteerError) {
        console.error('Puppeteer also failed:', puppeteerError.message);
      }
      
      // Return minimal data if all methods fail
      return {
        name: 'Stories Product',
        price: 'Price unavailable (blocked)',
        originalPrice: null,
        images: [],
        description: 'Unable to fetch product details due to site protection',
        sizes: [],
        color: '',
        sku: url.match(/(\d+)$/)?.[1] || '',
        brand: 'Stories',
        category: 'Fashion',
        isOnSale: false,
        inStock: false,
        url: url,
        error: `Blocked: ${error.response.status}`,
        needsPuppeteer: true
      };
    }
    
    throw error;
  }
}

module.exports = { scrapeStories: scrapeStoriesHTML };