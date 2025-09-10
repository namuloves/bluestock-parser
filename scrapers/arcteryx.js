const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

// Use puppeteer-extra with stealth plugin for better anti-detection
let puppeteer;
try {
  puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
} catch (e) {
  // Fall back to regular puppeteer if puppeteer-extra not available
  try {
    puppeteer = require('puppeteer');
  } catch (e2) {
    console.log('⚠️ Puppeteer not available');
  }
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
    
    let $;
    let htmlContent = '';
    
    // Arc'teryx requires JavaScript rendering, so go straight to Puppeteer
    console.log('📱 Arc\'teryx requires JavaScript - using Puppeteer...');
    
    if (!puppeteer) {
      throw new Error('Puppeteer is required for Arc\'teryx scraping but not available');
    }
      
    // Configure Puppeteer with better anti-detection
    const puppeteerOptions = {
      headless: process.env.NODE_ENV === 'production' ? 'new' : false, // Headless in production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--window-size=1920,1080',
        '--start-maximized',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: null
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
    
    // Add extra headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Navigate to the page with better wait strategy
    console.log('📍 Navigating to URL:', url);
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    } catch (navError) {
      console.log('⚠️ Initial navigation timed out, trying with reduced wait...');
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    }
    
    // Check if we got redirected
    const currentUrl = page.url();
    if (currentUrl !== url) {
      console.log('↪️ Redirected to:', currentUrl);
      
      // If redirected to a non-product page, throw error
      if (!currentUrl.includes('/shop/') || currentUrl.endsWith('/shop') || currentUrl.endsWith('/shop/')) {
        throw new Error('Redirected to shop page instead of product page. Please check the URL.');
      }
    }
    
    // Wait for the page to fully load with random delay to appear human
    const randomDelay = 3000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
      
    // Wait for content to load - wait for specific Arc'teryx elements
    try {
      await page.waitForSelector('h1, [class*="product"], [data-testid*="product"]', { timeout: 15000 });
      
      // Extra wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      console.log('⚠️ Could not find specific selectors, continuing...');
    }
      
    // Click on Product Details accordion sections to expand them
    console.log('📋 Expanding product detail sections...');
    
    // Try to click all accordion buttons to expand product details
    const accordionSelectors = [
      'button:has-text("Product details")',
      'button:has-text("Description")',
      'button:has-text("Features & Specs")',
      'button:has-text("Materials & Care")',
      'button:has-text("Fit & Sizing")',
      '[data-testid*="accordion"]',
      '[aria-expanded="false"]',
      '.accordion-button',
      '[class*="accordion"][class*="button"]',
      '[class*="expand"]',
      '[class*="collapse-trigger"]'
    ];
      
    for (const selector of accordionSelectors) {
      try {
        // Find all matching buttons
        const buttons = await page.$$(selector);
        
        for (const button of buttons) {
          try {
            // Check if button is visible and clickable
            const isVisible = await button.isIntersectingViewport();
            if (isVisible) {
              await button.click();
              // Small delay to allow content to expand
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (clickError) {
            // Individual button click failed, continue with others
          }
        }
      } catch (e) {
        // Selector didn't match any elements, try next one
      }
    }
    
    // Alternative approach: Click "Product details" button specifically
    try {
      // Look for the Product details button and click it
      const clicked = await page.evaluate(() => {
        // Find button containing "Product details" text
        const buttons = Array.from(document.querySelectorAll('button'));
        const productDetailsBtn = buttons.find(btn => 
          btn.textContent && btn.textContent.includes('Product details')
        );
        
        if (productDetailsBtn) {
          productDetailsBtn.click();
          return true;
        }
        
        // Also try clicking any closed accordions
        const closedAccordions = document.querySelectorAll('[aria-expanded="false"]');
        closedAccordions.forEach(acc => acc.click());
        
        return closedAccordions.length > 0;
      });
      
      if (clicked) {
        console.log('✅ Clicked Product details accordion');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      console.log('⚠️ Could not click Product details accordion');
    }
    
    // Try to expand all tabs/accordions using various methods
    const specificSections = [
      { text: 'Description', wait: '[class*="description-content"]' },
      { text: 'Features & Specs', wait: '[class*="features-content"]' },
      { text: 'Materials & Care', wait: '[class*="materials-content"]' },
      { text: 'Fit & Sizing', wait: '[class*="sizing-content"]' }
    ];
    
    for (const section of specificSections) {
      try {
        // Use page.evaluate to find and click buttons with specific text
        await page.evaluate((searchText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const targetButton = buttons.find(btn => 
            btn.textContent && btn.textContent.includes(searchText)
          );
          if (targetButton) {
            targetButton.click();
          }
        }, section.text);
        
        // Wait a bit for content to expand
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        // Section not found or couldn't be clicked
      }
    }
    
    // Wait for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the HTML content after expanding sections
    htmlContent = await page.content();
    $ = cheerio.load(htmlContent);
    
    console.log('✅ Successfully fetched with Puppeteer and expanded accordions');
    
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
    // Now also look in expanded accordion content
    product.description = $('[data-testid="product-description"]').text().trim() ||
                         $('.product-description').text().trim() ||
                         $('[class*="description-content"]').text().trim() ||
                         $('[aria-labelledby*="Description"]').text().trim() ||
                         $('[id*="description-panel"]').text().trim() ||
                         $('div:has(> h2:contains("Description")) + div').text().trim() ||
                         $('[class*="description"]').first().text().trim() || '';
    
    // Features - Arc'teryx products have detailed feature lists
    // Check both regular selectors and expanded accordion content
    const featuresList = [];
    
    // First try standard feature selectors
    $('[data-testid="product-features"] li, .product-features li, .features-list li').each((i, el) => {
      const feature = $(el).text().trim();
      if (feature) {
        featuresList.push(feature);
      }
    });
    
    // Also check expanded Features & Specs section
    $('[aria-labelledby*="Features"] li, [id*="features-panel"] li, [class*="features-content"] li').each((i, el) => {
      const feature = $(el).text().trim();
      if (feature && !featuresList.includes(feature)) {
        featuresList.push(feature);
      }
    });
    
    // Look for technical features in a structured format
    $('div:has(> h3:contains("Technical features"))').find('li').each((i, el) => {
      const feature = $(el).text().trim();
      if (feature && !featuresList.includes(feature)) {
        featuresList.push(feature);
      }
    });
    
    product.features = featuresList;
    
    // Material/Fabric - Check expanded Materials & Care section first
    let materialText = '';
    
    // Look for expanded Materials & Care accordion content
    const materialSelectors = [
      '[aria-labelledby*="Materials"]',
      '[id*="materials-panel"]',
      '[class*="materials-content"]',
      'div:has(> h2:contains("Materials & Care")) + div',
      'div:has(> h3:contains("Materials")) + div',
      '[data-testid="product-materials"]',
      '.product-materials'
    ];
    
    for (const selector of materialSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 10) {
        materialText = text;
        break;
      }
    }
    
    // Also check Construction section which often has material info
    if (!materialText) {
      const constructionText = $('div:has(> h3:contains("Construction"))').parent().text().trim() ||
                              $('div:has(> h4:contains("Construction"))').parent().text().trim() ||
                              $('[class*="construction"]').text().trim();
      if (constructionText) {
        materialText = constructionText;
      }
    }
    
    // Extract specific material information from the text
    if (materialText) {
      // Extract GORE-TEX type
      const goretexMatch = materialText.match(/GORE-TEX\s+[\w-]+(?:\s+(?:fabric|membrane))?/gi);
      if (goretexMatch) {
        product.material = goretexMatch[0];
      }
      
      // Look for face fabric specifications
      const fabricMatch = materialText.match(/\b\d+D\s+(?:face\s+)?(?:fabric|nylon|polyester)\b/gi);
      if (fabricMatch) {
        product.material = product.material ? 
          `${product.material}, ${fabricMatch.join(', ')}` : 
          fabricMatch.join(', ');
      }
      
      // Look for material composition percentages
      const compositionMatch = materialText.match(/\b\d+%\s+(?:nylon|polyester|polyamide|elastane|spandex|wool|cotton)\b/gi);
      if (compositionMatch && !product.material) {
        product.material = compositionMatch.join(', ');
      }
      
      // Look for special materials like C-KNIT, ePE membrane
      const specialMaterials = materialText.match(/(?:C-KNIT|ePE\s+membrane|PFC-free|DWR|RECCO|Coreloft)/gi);
      if (specialMaterials && !product.material) {
        product.material = specialMaterials.join(', ');
      }
    }
    
    // Fall back to checking description if no material found
    if (!product.material && product.description) {
      const goretexMatch = product.description.match(/GORE-TEX\s+[\w-]+(?:\s+fabric)?/i);
      if (goretexMatch) {
        product.material = goretexMatch[0];
      }
      
      const fabricMatch = product.description.match(/\b\d+D\s+(?:face\s+)?fabric\b/i);
      if (fabricMatch) {
        product.material = product.material ? 
          `${product.material}, ${fabricMatch[0]}` : 
          fabricMatch[0];
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
    // Check expanded specs section for weight
    let weightText = $('[data-testid="product-weight"]').text().trim() ||
                    $('.product-weight').text().trim() ||
                    $('li:contains("Weight:")').text().trim() ||
                    $('dt:contains("Weight")').next('dd').text().trim() ||
                    $('span:contains("Weight:")').parent().text().trim() || '';
    
    // Also check in the expanded Features & Specs section
    if (!weightText) {
      const specsText = $('[aria-labelledby*="Features"]').text() || 
                       $('[id*="features-panel"]').text() ||
                       $('[class*="features-content"]').text() || '';
      const weightLineMatch = specsText.match(/Weight[:\s]+(\d+(?:\.\d+)?)\s*(g|oz|kg|lb)/i);
      if (weightLineMatch) {
        weightText = weightLineMatch[0];
      }
    }
    
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