const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugSaks() {
  let browser;
  
  try {
    const url = 'https://www.saksfifthavenue.com/product/hunza-g-crinkle-effect-scoopneck-bikini-0400022347462.html';
    console.log('🔍 Debugging Saks Fifth Avenue page structure...');
    
    // Check for proxy configuration
    const proxyArgs = [];
    if (process.env.USE_PROXY === 'true' || (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD)) {
      let proxyUrl;
      if (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD) {
        const username = encodeURIComponent(process.env.DECODO_USERNAME);
        const password = encodeURIComponent(process.env.DECODO_PASSWORD);
        proxyUrl = `gate.decodo.com:10001`;
        proxyArgs.push(`--proxy-server=http://${proxyUrl}`);
        console.log('🔐 Using Decodo proxy');
      }
    }
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        ...proxyArgs,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set proxy authentication if using Decodo
    if (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD) {
      await page.authenticate({
        username: process.env.DECODO_USERNAME,
        password: process.env.DECODO_PASSWORD
      });
      console.log('🔑 Proxy authentication set');
    }
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🔍 Analyzing page structure...\n');
    
    // Debug selectors
    const debugInfo = await page.evaluate(() => {
      const findElements = (selectors) => {
        const results = {};
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              results[selector] = {
                count: elements.length,
                firstText: elements[0].textContent.trim().substring(0, 100)
              };
            }
          } catch (e) {
            // Skip invalid selectors
          }
        });
        return results;
      };
      
      // Test various possible selectors
      const priceSelectors = [
        '.price',
        '.product-price',
        '[class*="price"]',
        '[data-at*="price"]',
        'span[class*="Price"]',
        'div[class*="Price"]',
        '.bfx-price',
        '.product-detail-price'
      ];
      
      const brandSelectors = [
        '.brand',
        '.product-brand',
        '[class*="brand"]',
        '[data-at*="brand"]',
        'a[class*="Brand"]',
        'h1[class*="Brand"]',
        '.product-detail-brand'
      ];
      
      const sizeSelectors = [
        '.size-selector',
        '[class*="size"]',
        '[data-at*="size"]',
        'button[class*="Size"]',
        'input[type="radio"][name*="size"]',
        '.product-size-selector',
        '[aria-label*="size"]'
      ];
      
      const nameSelectors = [
        'h1',
        '.product-name',
        '[class*="product-name"]',
        '[data-at*="product-name"]',
        '.product-detail-name',
        'h1[class*="Name"]'
      ];
      
      return {
        prices: findElements(priceSelectors),
        brands: findElements(brandSelectors),
        sizes: findElements(sizeSelectors),
        names: findElements(nameSelectors),
        
        // Get all classes containing 'price' or 'brand' or 'size'
        allPriceClasses: Array.from(document.querySelectorAll('[class*="price" i]')).map(el => el.className).slice(0, 5),
        allBrandClasses: Array.from(document.querySelectorAll('[class*="brand" i]')).map(el => el.className).slice(0, 5),
        allSizeClasses: Array.from(document.querySelectorAll('[class*="size" i]')).map(el => el.className).slice(0, 5),
        
        // Check for React/Next.js data attributes
        dataAttributes: Array.from(document.querySelectorAll('[data-at]')).map(el => ({
          attr: el.getAttribute('data-at'),
          text: el.textContent.trim().substring(0, 50)
        })).slice(0, 10)
      };
    });
    
    console.log('📊 Price Selectors Found:');
    console.log(JSON.stringify(debugInfo.prices, null, 2));
    
    console.log('\n🏷️ Brand Selectors Found:');
    console.log(JSON.stringify(debugInfo.brands, null, 2));
    
    console.log('\n📏 Size Selectors Found:');
    console.log(JSON.stringify(debugInfo.sizes, null, 2));
    
    console.log('\n📝 Name Selectors Found:');
    console.log(JSON.stringify(debugInfo.names, null, 2));
    
    console.log('\n🔍 Price Classes:', debugInfo.allPriceClasses);
    console.log('🔍 Brand Classes:', debugInfo.allBrandClasses);
    console.log('🔍 Size Classes:', debugInfo.allSizeClasses);
    
    console.log('\n📋 Data Attributes:');
    debugInfo.dataAttributes.forEach(item => {
      console.log(`  [data-at="${item.attr}"]: ${item.text}`);
    });
    
    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'saks-debug.png', fullPage: false });
    console.log('\n📸 Screenshot saved as saks-debug.png');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugSaks();