const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeMytheresa = async (url) => {
  console.log('🛍️ Starting Mytheresa scraper for:', url);
  
  try {
    // Add headers to mimic a real browser more closely
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Mytheresa page...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Check if we got an error page
    const pageTitle = $('title').text().trim();
    const h1Text = $('h1').first().text().trim();
    
    if (pageTitle.includes('SOMETHING WENT WRONG') || h1Text.includes('SOMETHING WENT WRONG')) {
      console.log('⚠️ Mytheresa returned an error page (likely bot detection)');
      
      // Fallback: Extract basic info from URL and return partial data
      const urlParts = url.split('/');
      const productSlug = urlParts[urlParts.length - 1];
      const productInfo = productSlug.replace(/-p\d+$/, '').replace(/-/g, ' ');
      
      return {
        url,
        name: productInfo.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        brand: 'Mytheresa',
        price: 0,
        images: [],
        description: 'Product information requires manual verification',
        error: 'Bot detection - Unable to fetch full product details',
        needsManualCheck: true
      };
    }
    
    // Extract product data
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      colors: [],
      inStock: true,
      currency: 'USD',
      sku: '',
      material: '',
      details: []
    };
    
    // Try to extract JSON-LD structured data
    let productJson = null;
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const json = JSON.parse($(script).html());
        if (json['@type'] === 'Product' || (Array.isArray(json) && json.find(item => item['@type'] === 'Product'))) {
          productJson = Array.isArray(json) ? json.find(item => item['@type'] === 'Product') : json;
        }
      } catch (e) {
        // Continue to next script
      }
    });
    
    // Extract from structured data if available
    if (productJson) {
      console.log('✅ Found structured product data');
      
      product.name = productJson.name || '';
      product.brand = productJson.brand?.name || productJson.brand || '';
      product.description = productJson.description || '';
      product.sku = productJson.sku || '';
      
      if (productJson.image) {
        product.images = Array.isArray(productJson.image) ? productJson.image : [productJson.image];
      }
      
      if (productJson.offers) {
        const offers = Array.isArray(productJson.offers) ? productJson.offers[0] : productJson.offers;
        product.price = offers.price || '';
        product.currency = offers.priceCurrency || 'USD';
        product.inStock = offers.availability === 'http://schema.org/InStock' || 
                         offers.availability === 'https://schema.org/InStock';
      }
    }
    
    // Extract brand
    if (!product.brand) {
      product.brand = $('.product__area--info .product__area__brand a').text().trim() ||
                      $('[data-test="product-brand"]').text().trim() ||
                      $('.product-brand').text().trim();
    }
    
    // Extract product name
    if (!product.name) {
      product.name = $('.product__area--info .product__area__name').text().trim() ||
                     $('[data-test="product-name"]').text().trim() ||
                     $('h1.product-name').text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('h1').first().text().trim();
    }
    
    // Extract price
    if (!product.price) {
      // Look for current price
      const priceElement = $('.product__area__price .pricing__prices__price--current') ||
                          $('.product__area__price .pricing__prices__value') ||
                          $('[data-test="product-price"]');
      
      if (priceElement.length) {
        const priceText = priceElement.first().text().trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = priceMatch[0].replace(',', '');
        }
      }
    }
    
    // Extract original price (if on sale)
    const originalPriceElement = $('.product__area__price .pricing__prices__price--original') ||
                                 $('.product__area__price .pricing__prices__price--strikethrough');
    if (originalPriceElement.length) {
      const originalPriceText = originalPriceElement.first().text().trim();
      const priceMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        product.originalPrice = priceMatch[0].replace(',', '');
      }
    }
    
    // Extract images
    if (product.images.length === 0) {
      const imageSet = new Set();
      
      // Primary image gallery
      $('.product__gallery img, .product-images img, [data-test="product-image"] img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original');
        
        // Check for high-res version in data attributes
        const highRes = $(img).attr('data-zoom-image') || $(img).attr('data-large-image');
        if (highRes) {
          imageUrl = highRes;
        }
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = 'https://www.mytheresa.com' + imageUrl;
          }
          
          // Get highest quality version
          imageUrl = imageUrl.replace(/w=\d+/, 'w=1500')
                            .replace(/h=\d+/, 'h=1500')
                            .replace(/q=\d+/, 'q=100');
          
          imageSet.add(imageUrl);
        }
      });
      
      product.images = Array.from(imageSet);
    }
    
    // Extract sizes
    $('.product__area__size__options button, [data-test*="size-"] button, .size-selector button').each((i, sizeBtn) => {
      const size = $(sizeBtn).text().trim();
      const isAvailable = !$(sizeBtn).hasClass('disabled') && 
                         !$(sizeBtn).hasClass('sold-out') &&
                         !$(sizeBtn).is(':disabled');
      
      if (size && isAvailable) {
        product.sizes.push(size);
      }
    });
    
    // Extract colors
    $('.product__area__color__options button, [data-test*="color-"] button, .color-selector button').each((i, colorBtn) => {
      const color = $(colorBtn).attr('aria-label') || $(colorBtn).text().trim();
      if (color && !product.colors.includes(color)) {
        product.colors.push(color);
      }
    });
    
    // Extract description and details
    if (!product.description) {
      product.description = $('.product__area__details__text').text().trim() ||
                           $('[data-test="product-description"]').text().trim() ||
                           $('.product-description').text().trim();
    }
    
    // Extract material and care information
    $('.product__area__details__list li, .product-details li').each((i, li) => {
      const text = $(li).text().trim();
      if (text) {
        product.details.push(text);
        
        // Try to extract material
        if (text.toLowerCase().includes('material:') || text.toLowerCase().includes('composition:')) {
          product.material = text.replace(/material:|composition:/i, '').trim();
        }
      }
    });
    
    // Extract SKU/Product ID
    if (!product.sku) {
      product.sku = $('[data-test="product-id"]').text().trim() ||
                   $('.product-id').text().trim() ||
                   $('meta[property="product:retailer_item_id"]').attr('content');
    }
    
    // Check stock status
    const soldOutIndicator = $('.product__area__soldout, .sold-out-message, [data-test="sold-out"]');
    if (soldOutIndicator.length > 0) {
      product.inStock = false;
    }
    
    // Format prices with currency symbol
    const currencySymbol = product.currency === 'EUR' ? '€' : 
                          product.currency === 'GBP' ? '£' : '$';
    
    if (product.price && !product.price.includes(currencySymbol)) {
      product.price = currencySymbol + product.price;
    }
    if (product.originalPrice && !product.originalPrice.includes(currencySymbol)) {
      product.originalPrice = currencySymbol + product.originalPrice;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Mytheresa product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Mytheresa scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Check if a URL is from Mytheresa
const isMytheresaStore = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('mytheresa.com');
  } catch (error) {
    return false;
  }
};

module.exports = { scrapeMytheresa, isMytheresaStore };