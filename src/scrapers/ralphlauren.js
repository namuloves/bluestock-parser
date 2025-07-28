const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin with all evasions
puppeteer.use(StealthPlugin());

// Helper function to add random delays
const randomDelay = (min, max) => {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    setTimeout(resolve, delay);
  });
};

// First try to fetch via API endpoints
async function tryApiEndpoints(productId, url) {
  try {
    const axios = require('axios');
    const parsedUrl = new URL(url);
    
    // Common Salesforce Commerce Cloud API patterns
    const apiEndpoints = [
      `${parsedUrl.origin}/on/demandware.store/Sites-RalphLauren_US-Site/en_US/Product-GetVariations?pid=${productId}`,
      `${parsedUrl.origin}/s/RalphLauren_US/dw/shop/v20_2/products/${productId}?expand=availability,links,images,prices,variations`,
      `${parsedUrl.origin}/api/product/${productId}`,
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await axios.get(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': url
          },
          timeout: 10000
        });
        
        if (response.data) {
          console.log('Found API endpoint:', endpoint);
          return response.data;
        }
      } catch (e) {
        // Try next endpoint
      }
    }
  } catch (error) {
    console.log('API endpoints not accessible, falling back to browser automation');
  }
  return null;
}

async function scrapeRalphLauren(url, options = {}) {
  let browser;
  let page;
  let productIdMatch;
  let productId;
  
  try {
    // Extract product ID from URL
    productIdMatch = url.match(/\/(\d+)\.html/);
    productId = productIdMatch ? productIdMatch[1] : null;
    
    // Try API first
    if (productId) {
      const apiData = await tryApiEndpoints(productId, url);
      if (apiData) {
        return parseApiResponse(apiData);
      }
    }
    
    // Fallback to browser automation with Puppeteer
    browser = await puppeteer.launch({
      headless: options.headless !== false ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: null
    });
    
    page = await browser.newPage();
    
    // Set user agent and viewport
    await page.setUserAgent(getRandomUserAgent());
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    // Override navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({ query: () => Promise.resolve({ state: 'granted' }) })
      });
    });
    
    // Random delay before navigation
    await randomDelay(1000, 3000);
    
    // Navigate with realistic behavior
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for any anti-bot checks
    await randomDelay(3000, 5000);
    
    // Check if we hit a captcha or block page
    const title = await page.title();
    if (title.toLowerCase().includes('access denied') || title.toLowerCase().includes('captcha')) {
      throw new Error('Blocked by anti-bot protection');
    }
    
    // Wait for product content with Ralph Lauren specific selectors
    const selectors = [
      '[data-test-id="product-name"]',
      '[data-test="product-name"]',
      'h1[class*="ProductName"]',
      'h1[class*="product-name"]',
      '.product-detail-main h1',
      '.product-overview h1',
      '[class*="ProductOverview"] h1',
      'h1'
    ];
    
    let foundSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        foundSelector = selector;
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!foundSelector) {
      throw new Error('Product content not found');
    }
    
    // Add random mouse movements
    await page.mouse.move(100, 100);
    await randomDelay(500, 1000);
    await page.mouse.move(300, 300);
    
    // Extract product data with enhanced selectors
    const productData = await page.evaluate(() => {
      const getTextContent = (selectors) => {
        if (typeof selectors === 'string') selectors = [selectors];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        return '';
      };
      
      const getAttr = (selectors, attr) => {
        if (typeof selectors === 'string') selectors = [selectors];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element[attr]) {
            return element[attr];
          }
        }
        return '';
      };
      
      // Product name - enhanced selectors
      const name = getTextContent([
        'h1[class*="product-name"]',
        '[data-testid="product-name"]',
        'h1[itemprop="name"]',
        '.product-name',
        '.pdp-product-name',
        'h1.product-title',
        'h1'
      ]);
      
      // Price - enhanced selectors
      const priceSelectors = [
        '[class*="price-sales"]',
        '[class*="product-price"]',
        '[data-testid="product-price"]',
        '.price-sales',
        '.product-price',
        '[itemprop="price"]',
        '.pdp-price',
        '[class*="price"] [class*="sales"]'
      ];
      const price = getTextContent(priceSelectors);
      
      // Images - get high quality images
      const images = [];
      const imageSelectors = [
        'picture source[media*="1024"]',
        'img[class*="product-image"]',
        'img[data-testid*="product-image"]',
        '.product-image img',
        '[class*="gallery"] img',
        '.pdp-gallery img',
        'img[itemprop="image"]'
      ];
      
      imageSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(img => {
          const src = img.srcset || img.src || img.getAttribute('data-src');
          if (src && src.includes('ralphlauren') && !src.includes('placeholder')) {
            // Extract high-res version
            const highResSrc = src.replace(/w=\d+/, 'w=1000').replace(/h=\d+/, 'h=1000');
            images.push(highResSrc);
          }
        });
      });
      
      // Description - enhanced selectors
      const description = getTextContent([
        '[data-testid="product-description"]',
        '.product-description',
        '[class*="description"]',
        '.pdp-description',
        '[itemprop="description"]',
        '.product-details'
      ]);
      
      // Size options - enhanced
      const sizes = [];
      const sizeSelectors = [
        '[data-testid*="size"] button',
        '.size-selector button',
        'button[aria-label*="size"]',
        '[class*="size-selector"] button',
        '.swatches.size button',
        'div[class*="size"] button'
      ];
      
      sizeSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(size => {
          const sizeText = size.textContent || size.getAttribute('aria-label');
          if (sizeText && !size.disabled) {
            sizes.push(sizeText.trim());
          }
        });
      });
      
      // Color - enhanced
      const color = getTextContent([
        '[data-testid="selected-color"]',
        '.selected-color',
        '[class*="color-name"]',
        '.pdp-color-name',
        '[class*="selected"][class*="color"]',
        '.color-value'
      ]);
      
      // Additional product info
      const sku = getTextContent(['[itemprop="sku"]', '.product-id', '[class*="product-id"]']);
      const brand = getTextContent(['[itemprop="brand"]', '.brand-name']) || 'Ralph Lauren';
      
      // Check for structured data
      let structuredData = {};
      try {
        const ldJson = document.querySelector('script[type="application/ld+json"]');
        if (ldJson) {
          const data = JSON.parse(ldJson.textContent);
          if (data['@type'] === 'Product') {
            structuredData = data;
          }
        }
      } catch (e) {}
      
      return {
        name: name || structuredData.name || '',
        price: price || structuredData.offers?.price || '',
        images: [...new Set(images)].filter(img => img), // Remove duplicates and empty
        description: description || structuredData.description || '',
        sizes: [...new Set(sizes)],
        color,
        sku: sku || structuredData.sku || '',
        brand,
        url: window.location.href,
        structuredData
      };
    });
    
    // Validate we got essential data
    if (!productData.name || !productData.price) {
      // Try to extract from page source or API calls
      const pageContent = await page.content();
      const jsonMatch = pageContent.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
      if (jsonMatch) {
        try {
          const initialState = JSON.parse(jsonMatch[1]);
          // Extract from Redux/React state
          productData.name = productData.name || initialState.product?.name;
          productData.price = productData.price || initialState.product?.price;
        } catch (e) {}
      }
    }
    
    return productData;
    
  } catch (error) {
    console.error('Ralph Lauren scraper error:', error.message);
    
    // If blocked, try alternative approach
    if (error.message.includes('access denied') || error.message.includes('Product content not found')) {
      console.log('Attempting alternative scraping method...');
      // Return minimal data to avoid complete failure
      return {
        name: 'Ralph Lauren Product',
        price: 'Price not available',
        images: [],
        description: 'Unable to fetch product details due to site protection',
        sizes: [],
        color: '',
        sku: productIdMatch ? productIdMatch[1] : '',
        brand: 'Ralph Lauren',
        url: url,
        error: 'Site uses advanced bot protection. Consider using residential proxies.'
      };
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function for user agents
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Helper to parse API response
function parseApiResponse(data) {
  try {
    // Handle Salesforce Commerce Cloud response
    if (data.c_productName || data.name) {
      return {
        name: data.c_productName || data.name,
        price: data.price || data.prices?.sale || data.prices?.list,
        images: data.images?.map(img => img.disBaseLink || img.link) || [],
        description: data.longDescription || data.shortDescription,
        sizes: data.variations?.map(v => v.size) || [],
        color: data.c_color || data.color,
        sku: data.id,
        brand: data.brand || 'Ralph Lauren',
        url: data.c_productURL || ''
      };
    }
    
    // Handle other API formats
    return {
      name: data.title || data.product_name || '',
      price: data.price || data.product_price || '',
      images: data.images || data.product_images || [],
      description: data.description || '',
      sizes: data.available_sizes || [],
      color: data.color || '',
      sku: data.sku || data.product_id || '',
      brand: 'Ralph Lauren',
      url: ''
    };
  } catch (error) {
    console.error('Error parsing API response:', error);
    return null;
  }
}

// Export both regular and AI-powered scrapers
const { scrapeRalphLaurenWithAI } = require('./ralphlauren-ai');

module.exports = { 
  scrapeRalphLauren,
  scrapeRalphLaurenWithAI
};