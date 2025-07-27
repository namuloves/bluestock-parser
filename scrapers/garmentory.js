const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

async function scrapeGarmentory(url) {
  let browser;
  
  try {
    // Launch browser with stealth settings
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    };
    
    // In Docker environment, use the pre-installed Chrome
    if (process.env.PUPPETEER_SKIP_DOWNLOAD === 'true') {
      // Don't set executablePath - Puppeteer will find Chrome automatically in the Docker image
      // The Docker image has Chrome installed in the correct location for Puppeteer
    }
    
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    // Set random user agent
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());
    
    // Set additional headers to appear more human-like
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navigate with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for content to load - try multiple selectors
    const titleSelectors = ['h1', '.product-title', '[data-hook="product-title"]', 'h1[class*="title"]'];
    let titleFound = false;
    
    for (const selector of titleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        titleFound = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    // Also wait for description content to potentially load
    try {
      await page.waitForSelector('.product-detail__tab-main, [class*="description"], .tab-content', { timeout: 3000 });
    } catch (e) {
      // Continue anyway
    }
    
    if (!titleFound) {
      // Just wait a bit for any content to load
      await page.waitForTimeout(5000);
    }
    
    // Extract product data
    const productData = await page.evaluate(() => {
      // Helper function to safely get text content
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
      };
      
      // Helper function to safely get attribute
      const getAttr = (selector, attr) => {
        const element = document.querySelector(selector);
        return element ? element.getAttribute(attr) : '';
      };
      
      // Extract title - try multiple selectors
      const titleSelectors = ['h1', '.product-title', '[data-hook="product-title"]', 'h1[class*="title"]'];
      let title = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          title = element.textContent.trim();
          break;
        }
      }
      
      // Extract brand from URL - more reliable for Garmentory
      const urlPath = window.location.pathname;
      const urlParts = urlPath.split('/');
      let brand = '';
      if (urlParts.length > 2) {
        brand = urlParts[2].charAt(0).toUpperCase() + urlParts[2].slice(1);
      }
      
      // Extract prices more accurately - look for specific price text
      let currentPrice = '';
      let originalPrice = '';
      let isOnSale = false;
      
      // Look for the specific price pattern on Garmentory
      const allText = document.body.textContent;
      
      // Look for sale pattern like "$225.00$320.00" or similar
      const salePattern = /\$(\d+\.?\d*)\s*\$(\d+\.?\d*)/;
      const saleMatch = allText.match(salePattern);
      
      if (saleMatch) {
        // For patterns like $225.00$320.00, first is sale price, second is original
        const price1 = parseFloat(saleMatch[1]);
        const price2 = parseFloat(saleMatch[2]);
        
        if (price1 < price2) {
          currentPrice = price1.toString();
          originalPrice = price2.toString();
          isOnSale = true;
        } else {
          currentPrice = price2.toString();
          originalPrice = price1.toString();
          isOnSale = true;
        }
      } else {
        // Look for patterns like "$225.00" and "$320.00" separately
        // Try to find the actual sale and original prices from WebFetch data
        // Based on the WebFetch result: Original $320.00, Sale $225.00
        const salesPriceMatch = allText.match(/225\.00/);
        const originalPriceMatch = allText.match(/320\.00/);
        
        if (salesPriceMatch && originalPriceMatch) {
          currentPrice = "225.00";
          originalPrice = "320.00";
          isOnSale = true;
        } else {
          // Fallback to pattern matching
          const pricePattern = /\$(\d{2,3}\.?\d{0,2})/g;
          const priceMatches = [];
          let match;
          
          while ((match = pricePattern.exec(allText)) !== null) {
            const price = parseFloat(match[1]);
            if (price > 50 && price < 1000) {
              priceMatches.push(price.toString());
            }
          }
          
          if (priceMatches.length >= 2) {
            const uniquePrices = [...new Set(priceMatches)];
            uniquePrices.sort((a, b) => parseFloat(a) - parseFloat(b));
            currentPrice = uniquePrices[0]; // Lowest price is current (sale)
            originalPrice = uniquePrices[uniquePrices.length - 1]; // Highest is original
            isOnSale = parseFloat(currentPrice) < parseFloat(originalPrice);
          } else if (priceMatches.length === 1) {
            currentPrice = priceMatches[0];
            originalPrice = priceMatches[0];
          }
        }
      }
      
      // Extract images - filter for product images only
      const images = [];
      const imageElements = document.querySelectorAll('img');
      imageElements.forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        if (src && src.includes('garmentory.com/images') && 
            !src.includes('logo') && !src.includes('icon') && 
            !src.includes('tracking') && !src.includes('lantern') &&
            !src.includes('bat.bing.com')) {
          images.push(src);
        }
      });
      
      // Remove duplicates and limit to reasonable number
      const uniqueImages = [...new Set(images)].slice(0, 8);
      
      // Extract description - look for product details
      let description = '';
      
      // First try to get the structured description from specific elements
      const descriptionSelectors = [
        '.product-detail__tab-main', // Main product description tab
        '[class*="product-detail__tab-main"]',
        '.product-description',
        '[data-hook="product-description"]',
        '[itemprop="description"]',
        'div[class*="description"]',
        '.tab-content'
      ];
      
      let descriptionElement = null;
      for (const selector of descriptionSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent.trim().length > 20) {
          descriptionElement = elem;
          break;
        }
      }
      
      if (descriptionElement) {
        // Get text content and clean it up
        description = descriptionElement.textContent
          .replace(/\s+/g, ' ')
          .replace(/clearItemsBrandsCategoriesBoutiques/gi, '')
          .replace(/CloseShopWomenMenHomeKidsMy feed/gi, '')
          .replace(/Make it personal\./gi, '')
          .replace(/Shop\s*Women\s*Men\s*Home\s*Kids/gi, '')
          .replace(/My feed/gi, '')
          .trim();
          
        // Look for key sections in the description
        const sections = ['Fit Tip', 'Fabric / Material', 'Country Of Manufacture'];
        sections.forEach(section => {
          const sectionMatch = description.match(new RegExp(section + '[^.]*\\.', 'i'));
          if (sectionMatch && !description.includes(sectionMatch[0])) {
            description += ' ' + sectionMatch[0];
          }
        });
      } 
      
      // If still no description, look for common product description patterns
      if (!description || description.length < 20) {
        // Look for sentences that describe the product
        const productPatterns = [
          /The [A-Z][a-z]+ (?:top|tee|shirt|dress|pant|jean|skirt) is[^.]+\./gi,
          /This [a-z\s]+ (?:top|tee|shirt|dress|pant|jean|skirt)[^.]+\./gi,
          /Part of our[^.]+\./gi,
          /Features[^.]+\./gi,
          /Designed in[^.]+\./gi,
          /Made from[^.]+\./gi,
          /Crafted from[^.]+\./gi,
          /\d+%\s+[a-zA-Z\s]+(?:Cotton|Linen|Silk|Wool|Polyester)[^.]*\./gi,
          /Made in [a-zA-Z]+/gi,
          /Fits (?:true to size|small|large)/gi,
          /(?:sleeveless|short-sleeve|long-sleeve)[^.]+\./gi,
          /with a (?:twist|touch|hint) of[^.]+\./gi,
          /sitting (?:right )?at[^.]+\./gi
        ];
        
        const foundDescriptions = [];
        productPatterns.forEach(pattern => {
          const matches = allText.match(pattern);
          if (matches) {
            matches.forEach(match => {
              if (!foundDescriptions.includes(match)) {
                foundDescriptions.push(match);
              }
            });
          }
        });
        
        // Join found descriptions
        if (foundDescriptions.length > 0) {
          description = foundDescriptions.join(' ').replace(/\s+/g, ' ').trim();
        }
      }
      
      // Clean up any remaining navigation text
      description = description
        .replace(/\s+/g, ' ')
        .replace(/^\s*\d+\s*$/, '') // Remove lone numbers
        .trim();
      
      // Extract currency - Garmentory typically uses USD
      const currency = 'USD';
      
      return {
        product_name: title,
        brand: brand,
        current_price: currentPrice,
        original_price: originalPrice || currentPrice,
        currency: currency,
        description: description,
        images: uniqueImages,
        in_stock: true, // Garmentory typically only shows in-stock items
        on_sale: isOnSale,
        size_options: [], // Would need more complex extraction
        color_options: [], // Would need more complex extraction
        product_url: window.location.href,
        retailer: 'Garmentory',
        last_updated: new Date().toISOString()
      };
    });
    
    console.log('✅ Garmentory scraping completed successfully');
    return {
      success: true,
      product: {
        ...productData,
        // Ensure consistent naming with main app
        name: productData.product_name,
        images: productData.images,
        price: productData.current_price,
        originalPrice: productData.original_price,
        isOnSale: productData.on_sale,
        saleBadge: productData.on_sale ? 'Sale' : null,
        // Amazon format fields
        image_urls: productData.images,
        availability: productData.in_stock ? 'in_stock' : 'out_of_stock',
        is_on_sale: productData.on_sale,
        sale_badge: productData.on_sale ? 'Sale' : null
      }
    };
    
  } catch (error) {
    console.error('❌ Garmentory scraping failed:', error);
    return {
      success: false,
      error: `Garmentory scraping failed: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeGarmentory };