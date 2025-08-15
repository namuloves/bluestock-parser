const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeZara = async (url) => {
  console.log('🛍️ Starting Zara scraper for:', url);
  
  // Zara has strong bot protection, use API approach
  try {
    const { scrapeZaraAPI } = require('./zara-api');
    console.log('🚀 Using API approach for Zara...');
    const apiResult = await scrapeZaraAPI(url);
    if (apiResult && !apiResult.error) {
      return apiResult;
    }
  } catch (apiError) {
    console.log('⚠️ API approach failed:', apiError.message);
  }
  
  // Try Puppeteer as fallback
  try {
    const { scrapeZaraPuppeteer } = require('./zara-puppeteer');
    console.log('🚀 Trying Puppeteer for Zara...');
    const puppeteerResult = await scrapeZaraPuppeteer(url);
    if (!puppeteerResult.error && puppeteerResult.name) {
      return puppeteerResult;
    }
  } catch (puppeteerError) {
    console.log('⚠️ Puppeteer failed:', puppeteerError.message);
  }
  
  try {
    // Zara URLs typically look like:
    // https://www.zara.com/us/en/product-name-pXXXXXXX.html
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Zara page...');
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
      brand: 'Zara',
      sizes: [],
      colors: [],
      materials: [],
      inStock: true,
      productId: '',
      category: ''
    };
    
    // Extract product ID from URL
    const productIdMatch = url.match(/p(\d+)\.html/);
    if (productIdMatch) {
      product.productId = productIdMatch[1];
    }
    
    // Try to find product data in JSON-LD
    let productJson = null;
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product') {
          productJson = jsonData;
        } else if (Array.isArray(jsonData['@graph'])) {
          const productData = jsonData['@graph'].find(item => item['@type'] === 'Product');
          if (productData) {
            productJson = productData;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    if (productJson) {
      console.log('✅ Found product JSON-LD data');
      
      product.name = productJson.name || '';
      product.description = productJson.description || '';
      
      if (productJson.image) {
        if (typeof productJson.image === 'string') {
          product.images.push(productJson.image);
        } else if (Array.isArray(productJson.image)) {
          product.images = productJson.image;
        }
      }
      
      if (productJson.offers) {
        const offer = Array.isArray(productJson.offers) ? productJson.offers[0] : productJson.offers;
        
        if (offer.price) {
          product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
        }
        
        if (offer.priceCurrency) {
          product.currency = offer.priceCurrency;
        }
        
        product.inStock = offer.availability === 'http://schema.org/InStock' ||
                         offer.availability === 'https://schema.org/InStock';
      }
      
      if (productJson.color) {
        product.colors.push(productJson.color);
      }
      
      if (productJson.material) {
        product.materials.push(productJson.material);
      }
    }
    
    // Try to find Zara's app state data
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      
      // Look for window.__PRELOADED_STATE__ or similar
      if (scriptContent.includes('window.__PRELOADED_STATE__') || 
          scriptContent.includes('window.zara')) {
        const stateMatch = scriptContent.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/s) ||
                          scriptContent.match(/window\.zara\s*=\s*({.*?});/s);
        
        if (stateMatch) {
          try {
            const stateData = JSON.parse(stateMatch[1]);
            
            // Extract product details from state
            if (stateData.product) {
              const prod = stateData.product;
              
              product.name = product.name || prod.name || prod.productName;
              product.price = product.price || (prod.price ? `$${prod.price / 100}` : '');
              product.productId = product.productId || prod.id || prod.productId;
              
              if (prod.colors && Array.isArray(prod.colors)) {
                prod.colors.forEach(color => {
                  if (color.name && !product.colors.includes(color.name)) {
                    product.colors.push(color.name);
                  }
                });
              }
              
              if (prod.sizes && Array.isArray(prod.sizes)) {
                prod.sizes.forEach(size => {
                  if (size.name && !product.sizes.includes(size.name)) {
                    product.sizes.push(size.name);
                  }
                });
              }
              
              if (prod.images && Array.isArray(prod.images)) {
                prod.images.forEach(img => {
                  const imageUrl = img.url || img.src || img;
                  if (typeof imageUrl === 'string' && !product.images.includes(imageUrl)) {
                    product.images.push(imageUrl);
                  }
                });
              }
            }
          } catch (e) {
            console.log('Failed to parse Zara state data');
          }
        }
      }
    });
    
    // Fallback to HTML parsing
    if (!product.name) {
      product.name = $('h1.product-detail-info__header-name').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('h1').first().text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('title').text().split('|')[0].trim();
    }
    
    if (!product.price) {
      const priceText = $('.product-detail-info__price').text().trim() ||
                        $('.price__amount').text().trim() ||
                        $('[itemprop="price"]').attr('content') ||
                        $('.price').first().text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = '$' + priceMatch[0];
        }
      }
    }
    
    // Extract original price if on sale
    const originalPriceText = $('.price__amount--old').text().trim() ||
                              $('.product-detail-info__price--crossed').text().trim() ||
                              $('s.price').text().trim();
    
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = '$' + originalMatch[0];
      }
    }
    
    if (!product.description) {
      product.description = $('.product-detail-info__description').text().trim() ||
                            $('.expandable-text__inner').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Extract images from HTML
    if (product.images.length === 0) {
      // Zara typically has a carousel or gallery
      $('.media-image__image, .product-detail-images__image, img.media__image').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-zoom');
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          }
          
          // Get high-res version
          imageUrl = imageUrl.replace(/w=\d+/, 'w=1920')
                             .replace(/h=\d+/, 'h=2880')
                             .replace(/f=\w+/, 'f=jpg');
          
          if (!product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      });
      
      // Try meta image as fallback
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
    }
    
    // Extract sizes
    $('.size-selector__size-list button, .product-size-selector__size').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim();
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
      
      // Check if out of stock
      if ($(sizeEl).hasClass('disabled') || $(sizeEl).attr('disabled')) {
        // Size is out of stock
      }
    });
    
    // Extract colors
    $('.color-selector__color, .product-detail-color-selector__color').each((i, colorEl) => {
      const colorName = $(colorEl).attr('aria-label') || $(colorEl).attr('title') || $(colorEl).text().trim();
      if (colorName && !product.colors.includes(colorName)) {
        product.colors.push(colorName);
      }
    });
    
    // Extract materials/composition
    const compositionText = $('.product-detail-care-info__list').text() ||
                            $('.structured-component__text:contains("MATERIALS")').next().text();
    
    if (compositionText) {
      const materials = compositionText.match(/\d+%\s+\w+/g);
      if (materials) {
        product.materials = materials;
      }
    }
    
    // Extract category from breadcrumbs
    $('.breadcrumb__item').each((i, breadcrumb) => {
      const text = $(breadcrumb).text().trim();
      if (text && text !== 'Home' && !product.category) {
        product.category = text;
      }
    });
    
    // Check stock status
    const outOfStockIndicator = $('.product-detail-info__out-of-stock').text().trim() ||
                                $('button:contains("OUT OF STOCK")').text().trim();
    
    if (outOfStockIndicator) {
      product.inStock = false;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Zara product:', product.name || 'Unknown');
    console.log('   Price:', product.price || 'N/A');
    console.log('   Images:', product.images?.length || 0);
    console.log('   Sizes available:', product.sizes?.length || 0);
    
    return product;
    
  } catch (error) {
    console.error('❌ Zara scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      brand: 'Zara',
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeZara };