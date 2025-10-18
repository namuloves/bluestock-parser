const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function fullDebugSaks() {
  let browser;
  
  try {
    const url = 'https://www.saksfifthavenue.com/product/hunza-g-crinkle-effect-scoopneck-bikini-0400022347462.html';
    console.log('🔍 Full debug of Saks Fifth Avenue page...');
    console.log('URL:', url);
    console.log('---\n');
    
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
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('PAGE LOG:', msg.text());
      }
    });
    
    console.log('📄 Navigating to page...');
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Response status:', response.status());
    
    // Wait for content to potentially load
    console.log('⏳ Waiting for dynamic content...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try scrolling to trigger lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🔍 Extracting all product information...\n');
    
    // Extract comprehensive data
    const pageData = await page.evaluate(() => {
      // Helper to safely get text
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };
      
      const getAllText = (selector) => {
        const els = document.querySelectorAll(selector);
        return Array.from(els).map(el => el.textContent.trim());
      };
      
      // Get all script tags with potential data
      const scripts = Array.from(document.querySelectorAll('script')).map(s => {
        const content = s.textContent || '';
        if (content.includes('product') || content.includes('price') || content.includes('size')) {
          return content.substring(0, 500);
        }
        return null;
      }).filter(Boolean);
      
      // Look for product data in window object
      const windowData = {};
      try {
        if (window.dataLayer) windowData.dataLayer = window.dataLayer;
        if (window.productData) windowData.productData = window.productData;
        if (window.__INITIAL_STATE__) windowData.__INITIAL_STATE__ = window.__INITIAL_STATE__;
        if (window.pdpData) windowData.pdpData = window.pdpData;
      } catch (e) {
        console.log('Error accessing window data:', e);
      }
      
      // Check for size/color selectors
      const sizeButtons = document.querySelectorAll('button[aria-label*="size"], button[data-testid*="size"], [class*="size-selector"] button');
      const colorButtons = document.querySelectorAll('button[aria-label*="color"], button[data-testid*="color"], [class*="color-selector"] button');
      
      // Get product description from various possible locations
      const descriptionSelectors = [
        '.product-description',
        '[class*="description"]',
        '.product-details',
        '[class*="details"]',
        '.accordion-content',
        '[class*="accordion"] [class*="content"]'
      ];
      
      let description = null;
      for (const selector of descriptionSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim().length > 50) {
          description = el.textContent.trim();
          break;
        }
      }
      
      return {
        // Basic info we already get
        title: getText('h1'),
        brand: getText('.product__brand a') || getText('.cxds-titleBrand'),
        price: getText('.product__price:not(.strikethrough-price)'),
        originalPrice: getText('.strikethrough-price'),
        
        // Detailed selectors search
        allPrices: getAllText('[class*="price"]'),
        allBrands: getAllText('[class*="brand"]'),
        
        // Size information
        sizeButtonsCount: sizeButtons.length,
        sizeButtonsText: Array.from(sizeButtons).map(b => b.textContent.trim()),
        sizeButtonsAriaLabels: Array.from(sizeButtons).map(b => b.getAttribute('aria-label')),
        
        // Color information
        colorButtonsCount: colorButtons.length,
        colorButtonsText: Array.from(colorButtons).map(b => b.textContent.trim()),
        colorButtonsAriaLabels: Array.from(colorButtons).map(b => b.getAttribute('aria-label')),
        
        // Description
        description: description,
        
        // Product ID/SKU
        productId: getText('[class*="product-id"]') || getText('[class*="sku"]'),
        
        // Check for dropdowns
        hasSelectElements: document.querySelectorAll('select').length,
        selectOptions: Array.from(document.querySelectorAll('select')).map(s => ({
          name: s.name || s.id,
          options: Array.from(s.options).map(o => o.text)
        })),
        
        // Images count
        imageCount: document.querySelectorAll('img[src*="saksfifthavenue.com"]').length,
        
        // Scripts with data
        scriptsWithData: scripts.slice(0, 3),
        
        // Window data
        hasWindowData: Object.keys(windowData).length > 0,
        windowDataKeys: Object.keys(windowData),
        
        // Check for React/Next.js
        hasReactRoot: !!document.querySelector('#__next') || !!document.querySelector('#root'),
        
        // Page HTML structure (first 1000 chars of body)
        bodyStructure: document.body.innerHTML.substring(0, 1000)
      };
    });
    
    console.log('📊 Product Information:');
    console.log('---');
    console.log('Title:', pageData.title);
    console.log('Brand:', pageData.brand);
    console.log('Price:', pageData.price);
    console.log('Original Price:', pageData.originalPrice);
    console.log('Product ID:', pageData.productId);
    
    console.log('\n💰 All Prices Found:', pageData.allPrices.slice(0, 5));
    console.log('🏷️ All Brands Found:', pageData.allBrands.slice(0, 5));
    
    console.log('\n📏 Size Information:');
    console.log('Size buttons found:', pageData.sizeButtonsCount);
    console.log('Size button texts:', pageData.sizeButtonsText);
    console.log('Size button aria-labels:', pageData.sizeButtonsAriaLabels);
    
    console.log('\n🎨 Color Information:');
    console.log('Color buttons found:', pageData.colorButtonsCount);
    console.log('Color button texts:', pageData.colorButtonsText);
    console.log('Color button aria-labels:', pageData.colorButtonsAriaLabels);
    
    console.log('\n📝 Description:', pageData.description ? pageData.description.substring(0, 200) + '...' : 'Not found');
    
    console.log('\n🔍 Select/Dropdown Elements:');
    console.log('Has select elements:', pageData.hasSelectElements);
    if (pageData.selectOptions.length > 0) {
      pageData.selectOptions.forEach(select => {
        console.log(`  ${select.name}:`, select.options);
      });
    }
    
    console.log('\n🖼️ Images:', pageData.imageCount, 'images found');
    
    console.log('\n💻 Technical Details:');
    console.log('Has React/Next.js:', pageData.hasReactRoot);
    console.log('Has window data:', pageData.hasWindowData);
    console.log('Window data keys:', pageData.windowDataKeys);
    
    if (pageData.scriptsWithData.length > 0) {
      console.log('\n📜 Scripts with product data (first 500 chars):');
      pageData.scriptsWithData.forEach((script, i) => {
        console.log(`Script ${i + 1}:`, script.substring(0, 200) + '...');
      });
    }
    
    // Save page HTML for inspection
    const html = await page.content();
    fs.writeFileSync('saks-page.html', html);
    console.log('\n📄 Full page HTML saved to saks-page.html');
    
    // Take screenshots
    await page.screenshot({ path: 'saks-full-page.png', fullPage: true });
    console.log('📸 Full page screenshot saved as saks-full-page.png');
    
    // Try to interact with size selector if exists
    console.log('\n🔄 Attempting to interact with size/color selectors...');
    
    const hasInteractiveElements = await page.evaluate(() => {
      // Click on any size selector
      const sizeButton = document.querySelector('button[aria-label*="size"], [class*="size"] button');
      if (sizeButton) {
        sizeButton.click();
        return 'size-clicked';
      }
      
      // Click on dropdown
      const dropdown = document.querySelector('select[name*="size"], select[name*="Size"]');
      if (dropdown) {
        dropdown.click();
        return 'dropdown-clicked';
      }
      
      return 'no-interactive-elements';
    });
    
    console.log('Interaction result:', hasInteractiveElements);
    
    if (hasInteractiveElements !== 'no-interactive-elements') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: 'saks-after-interaction.png' });
      console.log('📸 Screenshot after interaction saved');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

fullDebugSaks();