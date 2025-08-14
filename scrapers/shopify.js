const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeShopify = async (url) => {
  console.log('🛍️ Starting Shopify scraper for:', url);
  
  try {
    // Add headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Shopify page...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
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
      variants: [],
      inStock: true,
      currency: 'USD',
      sku: '',
      vendor: ''
    };
    
    // Try to get Shopify product JSON from script tags
    let productJson = null;
    
    // Method 1: Look for ProductJSON in scripts
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      
      // Look for product JSON patterns
      if (scriptContent.includes('var meta = ') || scriptContent.includes('window.ShopifyAnalytics')) {
        const productMatch = scriptContent.match(/var meta = ({.*?});/s);
        if (productMatch) {
          try {
            const metaData = JSON.parse(productMatch[1]);
            if (metaData.product) {
              productJson = metaData.product;
            }
          } catch (e) {
            // Continue to next method
          }
        }
      }
      
      // Look for window.productJSON
      if (scriptContent.includes('window.productJSON') || scriptContent.includes('Product:')) {
        const jsonMatch = scriptContent.match(/window\.productJSON\s*=\s*({.*?});/s) ||
                          scriptContent.match(/"Product":\s*({.*?})\s*[,}]/s);
        if (jsonMatch) {
          try {
            productJson = JSON.parse(jsonMatch[1]);
          } catch (e) {
            // Continue to next method
          }
        }
      }
    });
    
    // Method 2: Try Shopify's .json endpoint
    if (!productJson) {
      try {
        const jsonUrl = url.includes('?') ? url.split('?')[0] + '.json' : url + '.json';
        console.log('📡 Fetching Shopify JSON endpoint...');
        const jsonResponse = await axios.get(jsonUrl, {
          ...axiosConfig,
          validateStatus: (status) => status === 200
        });
        
        if (jsonResponse.data && jsonResponse.data.product) {
          productJson = jsonResponse.data.product;
        }
      } catch (e) {
        console.log('JSON endpoint not available, using HTML parsing');
      }
    }
    
    // If we have JSON data, use it
    if (productJson) {
      console.log('✅ Found Shopify product JSON');
      
      product.name = productJson.title || '';
      product.vendor = productJson.vendor || '';
      product.brand = productJson.vendor || '';
      product.description = productJson.description || productJson.body_html || '';
      
      // Clean HTML from description
      if (product.description.includes('<')) {
        const $desc = cheerio.load(product.description);
        product.description = $desc.text().trim();
      }
      
      // Extract images
      if (productJson.images && Array.isArray(productJson.images)) {
        product.images = productJson.images.map(img => 
          typeof img === 'string' ? img : (img.src || img.url)
        ).filter(Boolean);
      } else if (productJson.image) {
        product.images = [productJson.image];
      }
      
      // Extract variants for sizes/colors/prices
      if (productJson.variants && Array.isArray(productJson.variants)) {
        productJson.variants.forEach(variant => {
          const variantData = {
            id: variant.id,
            title: variant.title,
            price: variant.price,
            comparePrice: variant.compare_at_price,
            available: variant.available,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3
          };
          
          product.variants.push(variantData);
          
          // Extract sizes
          if (variant.option1 && !product.sizes.includes(variant.option1)) {
            product.sizes.push(variant.option1);
          }
          
          // Extract colors (usually option2)
          if (variant.option2 && !product.colors.includes(variant.option2)) {
            product.colors.push(variant.option2);
          }
        });
        
        // Get price from first available variant
        const availableVariant = productJson.variants.find(v => v.available) || productJson.variants[0];
        if (availableVariant) {
          product.price = typeof availableVariant.price === 'string' ? 
            availableVariant.price : `${availableVariant.price / 100}`;
          
          if (availableVariant.compare_at_price) {
            product.originalPrice = typeof availableVariant.compare_at_price === 'string' ?
              availableVariant.compare_at_price : `${availableVariant.compare_at_price / 100}`;
          }
          
          product.inStock = availableVariant.available !== false;
        }
      }
    }
    
    // Fallback to HTML parsing if no JSON or missing data
    if (!product.name) {
      product.name = $('h1.product__title').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('h1').first().text().trim();
    }
    
    if (!product.price) {
      const priceText = $('.product__price').text().trim() ||
                        $('[itemprop="price"]').attr('content') ||
                        $('.price').first().text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = priceMatch[0];
        }
      }
    }
    
    if (!product.brand) {
      product.brand = $('.product__vendor').text().trim() ||
                      $('[itemprop="brand"]').text().trim() ||
                      $('meta[property="product:brand"]').attr('content') ||
                      new URL(url).hostname.replace('www.', '').split('.')[0];
    }
    
    if (product.images.length === 0) {
      // Extract images from HTML
      $('.product__media img, .product__image img, img[itemprop="image"]').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          }
          // Get larger version of image
          imageUrl = imageUrl.replace(/_\d+x\d+/, '').replace(/\?v=\d+/, '');
          if (!product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      });
    }
    
    if (!product.description) {
      product.description = $('.product__description').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('.product-single__description').text().trim();
    }
    
    // Format prices with currency
    if (product.price && !product.price.includes('$')) {
      product.price = '$' + product.price;
    }
    if (product.originalPrice && !product.originalPrice.includes('$')) {
      product.originalPrice = '$' + product.originalPrice;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Shopify product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Shopify scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Check if a URL is a Shopify store
const isShopifyStore = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const html = response.data.toLowerCase();
    
    return html.includes('shopify') ||
           html.includes('cdn.shopify') ||
           html.includes('/cdn/shop/') ||
           html.includes('myshopify.com');
  } catch (error) {
    return false;
  }
};

module.exports = { scrapeShopify, isShopifyStore };