const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFarfetch() {
  const url = 'https://www.farfetch.com/shopping/women/ganni-floral-print-graphic-t-shirt-item-31313693.aspx?storeid=9783';
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: false, // Set to false to see what's happening
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
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    
    console.log('📄 Navigating to:', url);
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());
    
    // Take a screenshot
    await page.screenshot({ path: 'farfetch-debug.png', fullPage: false });
    console.log('📸 Screenshot saved as farfetch-debug.png');
    
    // Wait for body
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Check if we're being blocked
    const pageContent = await page.content();
    if (pageContent.includes('Access Denied') || pageContent.includes('captcha') || pageContent.includes('blocked')) {
      console.log('⚠️ Page might be blocking us');
    }
    
    // Try waiting longer for dynamic content
    console.log('⏳ Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check what's on the page
    const debugInfo = await page.evaluate(() => {
      // Check for different selector patterns
      const selectors = {
        brand: [
          '[data-component="ProductBrandName"]',
          '[data-tstid="productDetails-brand"]', 
          'h1 a',
          'a[href*="/shopping/"]',
          '[class*="brand"]',
          '[class*="designer"]'
        ],
        name: [
          '[data-component="ProductDescription"]',
          '[data-tstid="productDetails-description"]',
          'h1 span',
          '[class*="product-name"]',
          '[class*="title"]'
        ],
        price: [
          '[data-component="PriceLarge"]',
          '[data-tstid="priceInfo-current"]',
          '[class*="price"]',
          'span[class*="price"]'
        ],
        images: [
          'img[src*="cdn-images.farfetch"]',
          '[data-component="ProductImage"] img',
          '[class*="image"] img',
          'picture img'
        ]
      };
      
      const results = {};
      
      for (const [key, selectorList] of Object.entries(selectors)) {
        results[key] = {};
        for (const selector of selectorList) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            results[key][selector] = {
              count: elements.length,
              firstText: elements[0].textContent?.trim().substring(0, 50),
              firstSrc: elements[0].src || elements[0].getAttribute('src')
            };
          }
        }
      }
      
      // Check for JSON-LD
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      results.jsonLdCount = scripts.length;
      
      // Get page title and check for specific content
      results.pageTitle = document.title;
      results.hasH1 = document.querySelectorAll('h1').length;
      results.allH1Text = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
      
      // Check all classes that might contain product info
      const productClasses = Array.from(document.querySelectorAll('[class*="product"], [class*="Product"]'));
      results.productClassCount = productClasses.length;
      
      return results;
    });
    
    console.log('\n🔍 Debug Information:');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    // Try to get raw HTML of potential product areas
    const productAreaHTML = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      // Get first 2000 characters to see structure
      return main.innerHTML.substring(0, 2000);
    });
    
    console.log('\n📄 Sample HTML structure:');
    console.log(productAreaHTML.substring(0, 500) + '...');
    
    // Wait for user to see browser (if not headless)
    console.log('\n⏸️ Browser will close in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugFarfetch();