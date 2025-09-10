const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

// Make Puppeteer optional - only load if available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.log('⚠️ Puppeteer not available, will use axios only');
}

const scrapeArcteryx = async (url) => {
  console.log('🏔️ Starting Arc\'teryx scraper for:', url);
  
  let browser;
  try {
    // Initialize product object
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Arc\'teryx',
      sizes: [],
      colors: [],
      material: '',
      inStock: true,
      currency: 'USD',
      retailer: 'Arc\'teryx',
      features: [],
      category: '',
      sku: '',
      weight: ''
    };

    // Try axios first with proper headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    };
    
    let $;
    let htmlContent = '';
    
    try {
      console.log('📡 Attempting to fetch with axios...');
      const axiosConfig = getAxiosConfig(url, {
        headers,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });
      
      const response = await axios.get(url, axiosConfig);
      
      if (response.status === 200) {
        console.log('✅ Successfully fetched with axios');
        htmlContent = response.data;
        $ = cheerio.load(htmlContent);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (axiosError) {
      console.log('⚠️ Axios failed with error:', axiosError.message);
      
      // Fall back to Puppeteer only if available
      if (!puppeteer) {
        throw new Error('Unable to fetch page - Puppeteer not available and axios failed');
      }
      
      console.log('📱 Using Puppeteer...');
      
      // Fall back to Puppeteer for sites with anti-bot protection
      const puppeteerOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
      
      // Use system Chrome if available (for Docker/Railway)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      
      browser = await puppeteer.launch(puppeteerOptions);
      
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for content to load - wait for specific Arc'teryx elements
      try {
        await page.waitForSelector('[data-testid="product-info"], .product-info, .pdp-main, h1', { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ Could not find specific selectors, continuing...');
      }
      
      // Get the HTML content
      htmlContent = await page.content();
      $ = cheerio.load(htmlContent);
      
      console.log('✅ Successfully fetched with Puppeteer');
    }
    
    // Extract product data
    console.log('📊 Extracting product data...');
    
    // Product name - Arc'teryx specific selectors
    product.name = $('h1[data-testid="product-name"]').text().trim() ||
                   $('h1.product-name').text().trim() ||
                   $('h1').first().text().trim() ||
                   $('meta[property="og:title"]').attr('content') || '';
    
    // Price extraction - Look for price in various formats
    const priceText = $('[data-testid="product-price"]').text().trim() ||
                     $('.product-price').text().trim() ||
                     $('.price-value').text().trim() ||
                     $('[class*="price"]').first().text().trim() || '';
    
    if (priceText) {
      // Extract current price and original price
      const priceMatch = priceText.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/g);
      if (priceMatch) {
        if (priceMatch.length > 1) {
          // If there are two prices, first is usually current, second is original
          product.price = priceMatch[0].trim();
          product.originalPrice = priceMatch[1].trim();
        } else {
          product.price = priceMatch[0].trim();
        }
        
        // Extract currency
        const currencyMatch = product.price.match(/[\$£€¥]/);
        if (currencyMatch) {
          switch(currencyMatch[0]) {
            case '£': product.currency = 'GBP'; break;
            case '€': product.currency = 'EUR'; break;
            case '¥': product.currency = 'JPY'; break;
            default: product.currency = 'USD';
          }
        }
      }
    }
    
    // Description - Arc'teryx usually has detailed product descriptions
    product.description = $('[data-testid="product-description"]').text().trim() ||
                         $('.product-description').text().trim() ||
                         $('[class*="description"]').first().text().trim() || '';
    
    // Features - Arc'teryx products have detailed feature lists
    const featuresList = [];
    $('[data-testid="product-features"] li, .product-features li, .features-list li').each((i, el) => {
      const feature = $(el).text().trim();
      if (feature) {
        featuresList.push(feature);
      }
    });
    product.features = featuresList;
    
    // Material/Fabric - Extract from description since Arc'teryx has it in expandable sections
    // Look for GORE-TEX and fabric mentions in the description
    if (product.description) {
      // Extract GORE-TEX type (match "GORE-TEX ePE fabric" or similar)
      const goretexMatch = product.description.match(/GORE-TEX\s+[\w-]+(?:\s+fabric)?/i);
      if (goretexMatch) {
        product.material = goretexMatch[0];
      }
      
      // Also look for face fabric (like "80D face fabric")
      const fabricMatch = product.description.match(/\b\d+D\s+(?:face\s+)?fabric\b/i);
      if (fabricMatch) {
        product.material = product.material ? 
          `${product.material}, ${fabricMatch[0]}` : 
          fabricMatch[0];
      }
      
      // Look for nylon/polyester percentages
      const compositionMatch = product.description.match(/\b\d+%\s+(?:nylon|polyester|polyamide|elastane)\b/gi);
      if (compositionMatch && !product.material) {
        product.material = compositionMatch.join(', ');
      }
    }
    
    // Try other selectors if no material found yet
    if (!product.material) {
      // Look for materials in various possible locations
      const materialSelectors = [
        '[data-testid="product-materials"]',
        '.product-materials',
        'section:contains("Materials")',
        'div:contains("Construction")',
        '[class*="material"]'
      ];
      
      for (const selector of materialSelectors) {
        const text = $(selector).first().text().trim();
        if (text && text.length < 200) {
          // Extract GORE-TEX or technical fabric mentions
          const techMatch = text.match(/(GORE-TEX[\s\w-]+|C-KNIT|ePE\s+membrane|\d+D\s+\w+)/i);
          if (techMatch) {
            product.material = techMatch[0];
            break;
          }
        }
      }
    }
    
    // Sizes - Look for size selector
    const sizesList = [];
    $('[data-testid*="size"] option, select[name*="size"] option, .size-selector button, [class*="size-option"]').each((i, el) => {
      const size = $(el).text().trim();
      const value = $(el).val() || $(el).attr('data-value') || '';
      
      // Skip placeholder options
      if (size && !size.toLowerCase().includes('select') && !size.toLowerCase().includes('choose')) {
        // Check if size is available (not disabled/out of stock)
        const isDisabled = $(el).prop('disabled') || $(el).hasClass('disabled') || $(el).hasClass('out-of-stock');
        if (!isDisabled) {
          sizesList.push(size);
        }
      }
    });
    product.sizes = [...new Set(sizesList)]; // Remove duplicates
    
    // Colors - Arc'teryx often has multiple color options
    const colorsList = [];
    $('[data-testid*="color"] option, select[name*="color"] option, .color-selector button, [class*="color-option"]').each((i, el) => {
      const color = $(el).text().trim() || $(el).attr('aria-label') || $(el).attr('title') || '';
      
      if (color && !color.toLowerCase().includes('select') && !color.toLowerCase().includes('choose')) {
        colorsList.push(color);
      }
    });
    
    // Also try to extract current color from product name or breadcrumb
    if (colorsList.length === 0) {
      const currentColor = $('.selected-color').text().trim() ||
                          $('[data-testid="selected-color"]').text().trim();
      if (currentColor) {
        colorsList.push(currentColor);
      }
    }
    
    product.colors = [...new Set(colorsList)]; // Remove duplicates
    
    // SKU/Product Code
    product.sku = $('[data-testid="product-sku"]').text().trim() ||
                  $('.product-sku').text().trim() ||
                  $('.product-code').text().trim() || '';
    
    // Clean SKU if it has a label
    if (product.sku.includes(':')) {
      product.sku = product.sku.split(':')[1].trim();
    }
    
    // Weight - Arc'teryx often lists product weight
    const weightText = $('[data-testid="product-weight"]').text().trim() ||
                      $('.product-weight').text().trim() || '';
    if (weightText) {
      const weightMatch = weightText.match(/(\d+(?:\.\d+)?)\s*(g|oz|kg|lb)/i);
      if (weightMatch) {
        product.weight = `${weightMatch[1]} ${weightMatch[2]}`;
      }
    }
    
    // Category - Extract from breadcrumbs or category info
    const breadcrumbs = [];
    $('.breadcrumb a, nav[aria-label="breadcrumb"] a, [data-testid="breadcrumb"] a').each((i, el) => {
      breadcrumbs.push($(el).text().trim());
    });
    
    if (breadcrumbs.length > 1) {
      // Usually last breadcrumb before current product is the category
      product.category = breadcrumbs[breadcrumbs.length - 2] || breadcrumbs[breadcrumbs.length - 1];
    }
    
    // Images
    const imageSet = new Set();
    
    // Primary image selectors for Arc'teryx
    const imageSelectors = [
      '[data-testid="product-image"] img',
      '.product-images img',
      '.pdp-images img',
      '.product-gallery img',
      '[class*="gallery"] img',
      '[class*="product-image"] img'
    ];
    
    // Try each selector to find product images
    for (const selector of imageSelectors) {
      $(selector).each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                      $(img).attr('data-src') || 
                      $(img).attr('data-lazy-src') || '';
        
        // Check srcset for higher quality
        const srcset = $(img).attr('srcset') || $(img).attr('data-srcset');
        if (srcset) {
          const srcsetParts = srcset.split(',');
          const highRes = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0];
          if (highRes) {
            imageUrl = highRes;
          }
        }
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            const baseUrl = new URL(url);
            imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
          }
          
          // Skip placeholder or tiny images
          if (!imageUrl.includes('placeholder') && 
              !imageUrl.includes('blank.gif') &&
              !imageUrl.includes('1x1') &&
              !imageUrl.startsWith('data:') &&
              imageUrl.includes('http')) {
            imageSet.add(imageUrl);
          }
        }
      });
    }
    
    // Also check for thumbnail images that might have larger versions
    $('[data-testid="product-thumbnail"] img, .product-thumbnails img, .thumbnail-image').each((i, img) => {
      let imageUrl = $(img).attr('data-full-image') || 
                    $(img).attr('data-zoom-image') ||
                    $(img).attr('src') || '';
      
      if (imageUrl) {
        // Convert to full URL if relative
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
        }
        
        if (imageUrl.includes('http')) {
          imageSet.add(imageUrl);
        }
      }
    });
    
    product.images = Array.from(imageSet);
    
    // Check for JSON-LD structured data
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const data of dataArray) {
          if (data['@type'] === 'Product') {
            // Fill in missing data from JSON-LD
            if (!product.name && data.name) {
              product.name = data.name;
            }
            
            if (!product.description && data.description) {
              product.description = data.description;
            }
            
            if (!product.sku && data.sku) {
              product.sku = data.sku;
            }
            
            if (data.offers) {
              const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              
              if (!product.price && offer.price) {
                product.price = `${offer.priceCurrency || '$'}${offer.price}`;
              }
              
              if (offer.priceCurrency) {
                product.currency = offer.priceCurrency;
              }
              
              if (offer.availability) {
                product.inStock = offer.availability.includes('InStock');
              }
            }
            
            if (data.image && product.images.length === 0) {
              const images = Array.isArray(data.image) ? data.image : [data.image];
              product.images = images.map(img => {
                if (typeof img === 'string') return img;
                if (img.url) return img.url;
                if (img['@id']) return img['@id'];
                return null;
              }).filter(Boolean);
            }
            
            if (data.category && !product.category) {
              product.category = data.category;
            }
            
            // Skip material from JSON-LD for Arc'teryx as it's often messy
            // We already extract material from description above
          }
        }
      } catch (e) {
        console.log('Error parsing JSON-LD:', e.message);
      }
    });
    
    // Check stock status
    const stockStatus = $('[data-testid="stock-status"]').text().trim() ||
                       $('.stock-status').text().trim() ||
                       $('.availability').text().trim() || '';
    
    if (stockStatus) {
      product.inStock = !stockStatus.toLowerCase().includes('out of stock') && 
                       !stockStatus.toLowerCase().includes('sold out');
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      const value = product[key];
      if (value === '' || 
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Arc\'teryx product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Arc\'teryx scraping error:', error.message);
    
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Check if URL is from Arc'teryx
const isArcteryx = (url) => {
  return url.includes('arcteryx.com');
};

module.exports = { scrapeArcteryx, isArcteryx };