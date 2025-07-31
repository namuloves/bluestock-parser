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
          brand: item.brand,
          price: item.price,
          sku: item.productId,
          color: item.color,
          size: item.size,
          category: item.category,
          fromDigitalData: true
        };
      }
      
      // Fallback to DOM scraping
      const name = getText('h1') || 
                   getText('[class*="product-name"]') ||
                   getText('[class*="ProductName"]') ||
                   document.title.split('|')[0].trim();
      
      const price = getText('[class*="price"]:not([class*="strike"])') ||
                    getText('[class*="Price"]') ||
                    '';
      
      const brand = getText('[class*="brand"]') ||
                    getText('[itemprop="brand"]') ||
                    'Ralph Lauren';
      
      // Extract images
      const images = [];
      document.querySelectorAll('img[src*="scene7.com"]').forEach(img => {
        const src = img.src;
        if (src && !src.includes('logo') && !src.includes('icon')) {
          images.push(src);
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
    if (typeof finalPrice === 'number') {
      finalPrice = `$${finalPrice}`;
    }
    
    // Get images if not found in digitalData
    let images = productData.images || [];
    if (images.length === 0) {
      images = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.dataset.src;
          if (src && src.includes('scene7.com') && !src.includes('logo')) {
            imgs.push(src);
          }
        });
        return imgs;
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