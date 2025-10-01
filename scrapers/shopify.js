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

      // Override vendor for known brands that use incorrect vendor names
      if (url.includes('stussy.com')) {
        product.brand = 'Stussy';
      } else {
        product.brand = productJson.vendor || '';
      }

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
          // Handle different price formats from Shopify stores
          if (typeof availableVariant.price === 'string') {
            // Price is already a string (like "183.00")
            // Remove any currency symbols and convert to number
            const cleanPrice = availableVariant.price.replace(/[^0-9.]/g, '');
            product.price = parseFloat(cleanPrice) || 0;
          } else if (typeof availableVariant.price === 'number') {
            // Check if price looks like cents (typically > 100 for most products)
            // But also check if it has decimals already
            if (Number.isInteger(availableVariant.price) && availableVariant.price > 100) {
              // Likely in cents, convert to dollars
              product.price = availableVariant.price / 100;
            } else {
              // Already in dollars
              product.price = availableVariant.price;
            }
          }

          if (availableVariant.compare_at_price) {
            if (typeof availableVariant.compare_at_price === 'string') {
              // Remove any currency symbols and convert to number
              const cleanPrice = availableVariant.compare_at_price.replace(/[^0-9.]/g, '');
              product.originalPrice = parseFloat(cleanPrice) || 0;
            } else if (typeof availableVariant.compare_at_price === 'number') {
              // Same logic for compare price
              if (Number.isInteger(availableVariant.compare_at_price) && availableVariant.compare_at_price > 100) {
                product.originalPrice = availableVariant.compare_at_price / 100;
              } else {
                product.originalPrice = availableVariant.compare_at_price;
              }
            }
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
          // Convert to number, removing commas
          product.price = parseFloat(priceMatch[0].replace(/,/g, '')) || 0;
        }
      }
    }
    
    if (!product.brand) {
      // First try to get brand from meta tags or structured data
      product.brand = $('meta[property="product:brand"]').attr('content') ||
                      $('[itemprop="brand"]').text().trim() ||
                      $('.product__vendor').text().trim();
      
      // If no brand found or if it's a different designer, use domain name
      const domainName = new URL(url).hostname.replace('www.', '').split('.')[0];
      const domainBrand = domainName.charAt(0).toUpperCase() + domainName.slice(1);
      
      // Special handling for known designer sites
      if (url.includes('ceciliebahnsen.com')) {
        product.brand = 'Cecilie Bahnsen';
      } else if (url.includes('stussy.com')) {
        product.brand = 'Stussy';
      } else if (!product.brand) {
        product.brand = domainBrand;
      }
    }
    
    if (product.images.length === 0) {
      // Extract images from HTML - including picture elements (used by Emurj)
      const imageSet = new Set();
      
      // Standard Shopify selectors - added .product-single__media for nhuhn.com
      $('.product__media img, .product__image img, .product-single__media img, img[itemprop="image"], picture img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src');
        
        // Also check srcset for higher quality images
        const srcset = $(img).attr('srcset');
        if (srcset) {
          // Get the highest resolution image from srcset
          const srcsetParts = srcset.split(',');
          const lastSrc = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0];
          if (lastSrc) {
            imageUrl = lastSrc;
          }
        }
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          }
          
          // For Emurj-style URLs, extract a cleaner version
          if (imageUrl.includes('/files/') && imageUrl.includes('?')) {
            // Get base URL without parameters but keep version
            const baseUrl = imageUrl.split('&')[0];
            // Replace with higher resolution version
            imageUrl = baseUrl.replace(/width=\d+/, 'width=1500').replace(/height=\d+/, 'height=1500');
          } else {
            // Standard Shopify image cleanup
            imageUrl = imageUrl.replace(/_\d+x\d+/, '').replace(/\?v=\d+/, '');
          }
          
          imageSet.add(imageUrl);
        }
      });
      
      // Convert Set to Array to remove duplicates
      product.images = Array.from(imageSet);
      
      // For Emurj/similar sites, dedupe by unique image ID and filter out related products
      if (product.images.length > 0 && product.images[0].includes('/files/')) {
        const uniqueImages = new Map();
        
        // First, identify the main product ID from URL
        const urlMatch = url.match(/\/(\d+)(?:\?.*)?$/);
        const productId = urlMatch ? urlMatch[1] : null;
        
        product.images.forEach(img => {
          // Skip card images (related products)
          if (img.includes('-card-') || img.includes('_card_')) {
            return;
          }
          
          // If we have a product ID, prioritize images that start with it
          if (productId && img.includes(`/${productId}-`)) {
            // Extract unique ID (e.g., "100341-918ef3f3-89d3-4629-a98a-40ed7bfc6903")
            const match = img.match(/\/([^\/]+\-[a-f0-9\-]+)\.(png|jpg|jpeg|webp)/i);
            if (match) {
              const imageId = match[1];
              // Keep the first occurrence of each unique image
              if (!uniqueImages.has(imageId)) {
                uniqueImages.set(imageId, img);
              }
            }
          } else if (!productId) {
            // If no product ID, keep non-card images
            const match = img.match(/\/([^\/]+\-[a-f0-9\-]+)\.(png|jpg|jpeg|webp)/i);
            if (match) {
              const imageId = match[1];
              if (!uniqueImages.has(imageId)) {
                uniqueImages.set(imageId, img);
              }
            }
          }
        });
        
        product.images = Array.from(uniqueImages.values());
      }
    }
    
    if (!product.description) {
      product.description = $('.product__description').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('.product-single__description').text().trim();
    }
    
    // Ensure prices are numbers (not strings with currency symbols)
    // This helps maintain consistency across all scrapers
    
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