const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function scrapeRalphLaurenWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Ralph Lauren...');
    
    // Launch browser with stealth mode
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Additional anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
    });
    
    // Navigate to the page
    console.log('📄 Navigating to Ralph Lauren page...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Scroll to trigger image loading
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if blocked
    const pageTitle = await page.title();
    console.log('📄 Page title:', pageTitle);
    
    if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked')) {
      console.log('⚠️ Ralph Lauren is blocking the request');
      return {
        name: 'Product temporarily unavailable',
        price: 'Unable to fetch price',
        images: [],
        description: 'Ralph Lauren is blocking automated requests.',
        error: 'Blocked by anti-bot protection'
      };
    }
    
    // Extract product data
    console.log('📊 Extracting product data...');
    const productData = await page.evaluate(() => {
      // Helper function to get text content safely
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
      };
      
      // Try to find digitalData first
      if (window.digitalData && window.digitalData.product && window.digitalData.product.item) {
        const item = window.digitalData.product.item[0];
        return {
          name: item.productName,
          brand: item.productBrand || item.brand,
          price: item.productPrice || item.price,
          sku: item.productID || item.productId,
          color: item.color,
          size: item.size,
          category: item.productCategory || item.category,
          fromDigitalData: true
        };
      }
      
      // Fallback to DOM scraping
      const name = getText('h1') || 
                   getText('[class*="product-name"]') ||
                   getText('[class*="ProductName"]') ||
                   document.title.split('|')[0].trim();
      
      // Extract price - look for elements with dollar signs
      let price = '';
      const priceSelectors = [
        '.product-price',
        '[class*="price"]:not([class*="strike"]):not([class*="was"])',
        '[class*="Price"]:not([class*="Original"])',
        'span[itemprop="price"]'
      ];
      
      for (const selector of priceSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const text = elem.textContent.trim();
          if (text.includes('$')) {
            price = text;
            break;
          }
        }
      }
      
      const brand = getText('[class*="brand"]') ||
                    getText('[itemprop="brand"]') ||
                    'Ralph Lauren';
      
      // Extract images - filter out swatches and non-product images
      const images = [];
      document.querySelectorAll('img[src*="scene7.com"]').forEach(img => {
        const src = img.src;
        const alt = img.alt || '';
        
        // Skip swatches, logos, icons
        if (src && 
            !src.includes('swatch') && 
            !src.includes('logo') && 
            !src.includes('icon') &&
            !src.includes('$rl_df_40_swatch$') &&
            (src.includes('lifestyle') || 
             src.includes('main') || 
             src.includes('detail') ||
             src.includes('$rl_') ||
             alt.toLowerCase().includes('pant') ||
             alt.toLowerCase().includes('shirt'))) {
          // Convert to high resolution
          const highResSrc = src.replace(/\$rl_[^$]+\$/, '$rl_df_zoom$')
                                .replace(/\?.*$/, '?$rl_df_zoom$');
          if (!images.includes(highResSrc)) {
            images.push(highResSrc);
          }
        }
      });
      
      return {
        name,
        price,
        brand,
        images: images.slice(0, 10),
        fromDigitalData: false
      };
    });
    
    console.log('✅ Data extracted:', productData.fromDigitalData ? 'from digitalData' : 'from DOM');
    
    // Process price
    let finalPrice = productData.price;
    if (finalPrice && !String(finalPrice).includes('$')) {
      finalPrice = `$${finalPrice}`;
    }
    
    // Get images if not found in digitalData
    let images = productData.images || [];
    if (images.length === 0) {
      images = await page.evaluate(() => {
        const imgs = [];
        // Look for main product images
        const imageSelectors = [
          '.product-image-main img',
          '.product-images img',
          '[class*="gallery"] img',
          'img[alt*="lifestyle"]',
          'img[alt*="main"]'
        ];
        
        imageSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(img => {
            const src = img.src || img.dataset.src;
            if (src && src.includes('scene7.com') && 
                !src.includes('swatch') && 
                !src.includes('logo')) {
              const highResSrc = src.replace(/\$rl_[^$]+\$/, '$rl_df_zoom$');
              if (!imgs.includes(highResSrc)) {
                imgs.push(highResSrc);
              }
            }
          });
        });
        
        // If still no images, get any scene7 images (excluding swatches)
        if (imgs.length === 0) {
          document.querySelectorAll('img[src*=\"scene7.com\"]').forEach(img => {
            const src = img.src;
            if (src && !src.includes('swatch') && !src.includes('$rl_df_40_swatch$')) {
              imgs.push(src);
            }
          });
        }
        
        return imgs.slice(0, 10);
      });
    }
    
    return {
      name: productData.name || 'Ralph Lauren Product',
      price: finalPrice || 'Price not available',
      images: images,
      brand: productData.brand || 'Ralph Lauren',
      color: productData.color || '',
      sku: productData.sku || '',
      category: productData.category || '',
      url: url
    };
    
  } catch (error) {
    console.error('Ralph Lauren Puppeteer error:', error.message);
    
    return {
      name: 'Ralph Lauren Product',
      price: 'Price unavailable',
      images: [],
      description: 'Unable to fetch product details',
      error: error.message
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeRalphLaurenWithPuppeteer };