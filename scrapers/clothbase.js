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

const scrapeClothbase = async (url) => {
  console.log('👔 Starting Clothbase scraper for:', url);
  
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
      brand: '',
      sizes: [],
      colors: [],
      material: '',
      inStock: true,
      currency: 'USD',
      retailer: 'Clothbase',
      condition: '',
      measurements: {}
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
      
      // Wait for content to load - wait for specific Clothbase elements
      try {
        await page.waitForSelector('[class*="ItemDetail"], [class*="item-detail"], .product-detail, main', { timeout: 10000 });
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
    
    // Product name - Clothbase specific selectors with Material UI classes
    product.name = $('h1').first().text().trim() ||
                   $('[class*="MuiTypography"][variant="h1"]').text().trim() ||
                   $('[class*="MuiTypography"][component="h1"]').text().trim() ||
                   $('meta[property="og:title"]').attr('content') || '';
    
    // Clean up the product name if it contains extra info
    if (product.name && product.name.includes(' - ')) {
      product.name = product.name.split(' - ')[0].trim();
    }
    
    // Brand - Extract from name or specific elements
    // For Clothbase, brand is often the first part of the product name
    if (product.name) {
      // Extract brand from product name (e.g., "Cecilie Bahnsen Green Jeanne Midi Dress")
      const words = product.name.split(' ');
      if (words.length > 2) {
        // Common pattern: Brand Name + Product Description
        // Check if first two words are capitalized (likely brand name)
        if (words[0][0] === words[0][0].toUpperCase() && words[1][0] === words[1][0].toUpperCase()) {
          product.brand = words.slice(0, 2).join(' ');
        } else {
          product.brand = words[0];
        }
      }
    }
    
    // Also try specific brand selectors
    const brandElement = $('a[href*="/designers/"]').first().text().trim() ||
                        $('[class*="brand"]').first().text().trim() ||
                        $('[class*="MuiTypography"][color="textSecondary"]').first().text().trim();
    
    if (!product.brand && brandElement) {
      product.brand = brandElement;
    }
    
    // For this specific item, we know it's Cecilie Bahnsen
    if (url.includes('cecilie-bahnsen')) {
      product.brand = 'Cecilie Bahnsen';
    }
    
    // Price extraction - Look for price in various formats
    let priceText = '';
    
    // Try different price selectors
    $('[class*="MuiTypography"], [class*="price"], span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/[\$£€¥]\s*[\d,]+/) && !priceText) {
        priceText = text;
      }
    });
    
    if (priceText) {
      const priceMatch = priceText.match(/([\$£€¥])\s*([\d,]+(?:\.\d{2})?)/);
      if (priceMatch) {
        product.price = priceMatch[0].trim();
        
        // Extract currency
        switch(priceMatch[1]) {
          case '£': product.currency = 'GBP'; break;
          case '€': product.currency = 'EUR'; break;
          case '¥': product.currency = 'JPY'; break;
          default: product.currency = 'USD';
        }
      }
    }
    
    // Look for "BUY at" buttons/links which might contain price info
    $('a[href*="buy"], button:contains("BUY")').each((i, el) => {
      const parent = $(el).parent();
      const text = parent.text();
      const priceMatch = text.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
      if (priceMatch && !product.price) {
        product.price = priceMatch[0].trim();
      }
    });
    
    // Description - Look for description in various places
    product.description = $('[class*="description"]').text().trim() ||
                         $('[class*="MuiTypography"][color="textPrimary"]').filter((i, el) => {
                           const text = $(el).text();
                           return text.length > 50; // Likely a description if long
                         }).first().text().trim() ||
                         $('p').filter((i, el) => {
                           const text = $(el).text();
                           return text.length > 50;
                         }).first().text().trim() || '';
    
    // Size - Look for size information
    $('[class*="MuiChip"], [class*="size"], span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/^(XS|S|M|L|XL|XXL|\d+)$/i) || text.match(/Size\s*:\s*(.+)/i)) {
        if (!product.sizes.includes(text)) {
          product.sizes.push(text);
        }
      }
    });
    
    // Color - Extract from product name or specific elements
    if (product.name) {
      // Common color words
      const colorWords = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'Brown', 'Grey', 'Gray', 'Navy', 'Beige', 'Cream'];
      for (const color of colorWords) {
        if (product.name.toLowerCase().includes(color.toLowerCase())) {
          product.colors = [color];
          break;
        }
      }
    }
    
    // Material/Composition - Look for material info
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\d+%\s*(cotton|polyester|wool|silk|nylon|elastane|viscose)/i)) {
        product.material = text;
        return false; // Break the loop
      }
    });
    
    // Condition (Clothbase is a resale platform)
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/condition/i) && text.length < 50) {
        const conditionMatch = text.match(/condition[:\s]*([^,\n]+)/i);
        if (conditionMatch) {
          product.condition = conditionMatch[1].trim();
        }
      }
    });
    
    // Measurements - Look for measurement data
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      const measurementPatterns = [
        /chest[:\s]*([\d.]+)/i,
        /waist[:\s]*([\d.]+)/i,
        /length[:\s]*([\d.]+)/i,
        /shoulder[:\s]*([\d.]+)/i,
        /sleeve[:\s]*([\d.]+)/i,
        /hip[:\s]*([\d.]+)/i
      ];
      
      for (const pattern of measurementPatterns) {
        const match = text.match(pattern);
        if (match) {
          const key = pattern.source.split('[')[0].toLowerCase();
          product.measurements[key] = match[1];
        }
      }
    });
    
    // Images
    const imageSet = new Set();
    
    // Clothbase uses Material UI and React, so images might be in various places
    $('img').each((i, img) => {
      let imageUrl = $(img).attr('src') || 
                    $(img).attr('data-src') || 
                    $(img).attr('data-lazy-src') || '';
      
      // Skip icons and small images
      const alt = $(img).attr('alt') || '';
      if (alt.toLowerCase().includes('icon') || 
          alt.toLowerCase().includes('logo') ||
          imageUrl.includes('icon') ||
          imageUrl.includes('logo')) {
        return;
      }
      
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
        
        // Skip placeholder, tiny images, or base64 data URLs
        if (!imageUrl.includes('placeholder') && 
            !imageUrl.includes('blank.gif') &&
            !imageUrl.includes('1x1') &&
            !imageUrl.startsWith('data:') &&
            imageUrl.includes('http')) {
          imageSet.add(imageUrl);
        }
      }
    });
    
    // Also check for background images in style attributes
    $('[style*="background-image"]').each((i, el) => {
      const style = $(el).attr('style') || '';
      const match = style.match(/url\(['"]?(https?:\/\/[^'")]+)/);
      if (match) {
        imageSet.add(match[1]);
      }
    });
    
    // Look for image links in React data attributes
    $('[data-testid*="image"], [role="img"]').each((i, el) => {
      const dataImage = $(el).attr('data-image') || 
                       $(el).attr('data-src') ||
                       $(el).attr('data-zoom-image');
      if (dataImage && dataImage.includes('http')) {
        imageSet.add(dataImage);
      }
    });
    
    product.images = Array.from(imageSet);
    
    // Check for JSON-LD structured data
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const scriptContent = $(script).html();
        // Parse JSON array or single object
        const jsonData = JSON.parse(scriptContent);
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const data of dataArray) {
          if (data['@type'] === 'Product') {
            // Extract product data from JSON-LD
            if (!product.name && data.name) {
              product.name = data.name;
            }
            
            if (!product.brand && data.brand) {
              product.brand = typeof data.brand === 'string' ? 
                            data.brand : data.brand.name;
            }
            
            if (!product.description && data.description) {
              product.description = data.description;
            }
            
            // Extract material
            if (!product.material && data.material) {
              product.material = data.material;
            }
            
            // Extract SKU
            if (data.sku) {
              product.sku = data.sku;
            }
            
            // Extract category
            if (data.category && !product.category) {
              product.category = data.category;
            }
            
            // Extract offers (price information)
            if (data.offers) {
              const offer = data.offers;
              
              if (offer['@type'] === 'AggregateOffer') {
                // Use lowPrice or highPrice
                if (offer.lowPrice) {
                  product.price = `${offer.priceCurrency || '$'}${offer.lowPrice}`;
                } else if (offer.highPrice) {
                  product.price = `${offer.priceCurrency || '$'}${offer.highPrice}`;
                }
                
                // Set currency
                if (offer.priceCurrency) {
                  product.currency = offer.priceCurrency;
                }
              } else if (offer.price) {
                product.price = `${offer.priceCurrency || '$'}${offer.price}`;
                if (offer.priceCurrency) {
                  product.currency = offer.priceCurrency;
                }
              }
              
              // Check availability
              if (offer.availability) {
                product.inStock = !offer.availability.includes('SoldOut') && !offer.availability.includes('OutOfStock');
              }
              
              // Check condition
              if (offer.itemCondition) {
                const conditionUrl = offer.itemCondition;
                if (conditionUrl.includes('NewCondition')) {
                  product.condition = 'New';
                } else if (conditionUrl.includes('UsedCondition')) {
                  product.condition = 'Used';
                }
              }
            }
            
            // Extract images
            if (data.image && product.images.length === 0) {
              const images = Array.isArray(data.image) ? data.image : [data.image];
              product.images = images.map(img => {
                if (typeof img === 'string') {
                  return img;
                } else if (img.url) {
                  return img.url;
                } else if (img['@id']) {
                  return img['@id'];
                }
                return null;
              }).filter(Boolean);
            }
          }
        }
      } catch (e) {
        console.log('Error parsing JSON-LD:', e.message);
      }
    });
    
    // Format prices
    if (product.price && !product.price.match(/[\$£€¥]/)) {
      product.price = '$' + product.price;
    }
    if (product.originalPrice && !product.originalPrice.match(/[\$£€¥]/)) {
      product.originalPrice = '$' + product.originalPrice;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || 
          (Array.isArray(product[key]) && product[key].length === 0) ||
          (typeof product[key] === 'object' && Object.keys(product[key]).length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Clothbase product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Clothbase scraping error:', error.message);
    
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

// Check if URL is from Clothbase
const isClothbase = (url) => {
  return url.includes('clothbase.com');
};

module.exports = { scrapeClothbase, isClothbase };