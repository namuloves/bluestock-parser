const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeSsense(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for SSENSE...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
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
    
    console.log('📄 Navigating to SSENSE page...');
    
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());
    
    // Wait for the page to render
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take a screenshot for debugging
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    console.log('🔍 Extracting product data...');
    
    // Get all the data in one evaluation
    const productData = await page.evaluate(() => {
      // Helper functions
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };
      
      const getAllText = (selector) => {
        const els = document.querySelectorAll(selector);
        return Array.from(els).map(el => el.textContent.trim());
      };
      
      // Try to get JSON-LD first
      let jsonLd = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Product' || data.name) {
            jsonLd = data;
            break;
          }
        } catch (e) {
          // Continue to next script
        }
      }
      
      // Extract from page elements
      const result = {
        jsonLd: jsonLd,
        pageData: {
          // Try multiple selectors for each field
          name: getText('.pdp-product-title__name') || 
                getText('h2.pdp-product-title__name') ||
                getText('[class*="product-title__name"]') ||
                getText('h2'),
          
          brand: getText('.pdp-product-title__brand') || 
                 getText('h1.pdp-product-title__brand') ||
                 getText('[class*="product-title__brand"]') ||
                 getText('a[href*="/designer"]') ||
                 getText('h1'),
          
          price: getText('.product-price__price') || 
                 getText('span.product-price__price') ||
                 getText('[class*="price__price"]:not([class*="original"])') ||
                 getText('[class*="price"]'),
          
          originalPrice: getText('[class*="original"]') ||
                        getText('[class*="crossed"]'),
          
          description: getText('.pdp-product-details__content') ||
                      getText('[class*="product-details"]') ||
                      getText('[class*="description"]'),
          
          // Get all image URLs
          images: Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src && src.includes('ssensemedia.com'))
            .map(src => src.split('?')[0]),
          
          // Get sizes
          sizes: getAllText('.pdp-product-size__option button:not([disabled])') ||
                 getAllText('[class*="size__option"] button:not([disabled])') ||
                 getAllText('button[class*="size"]:not([disabled])'),
          
          // Check availability
          inStock: !document.querySelector('[class*="sold-out"]') && 
                   !document.querySelector('[class*="out-of-stock"]')
        },
        
        // Debug info
        hasJsonLd: !!jsonLd,
        scriptCount: scripts.length,
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };
      
      return result;
    });
    
    console.log('Debug info:', {
      hasJsonLd: productData.hasJsonLd,
      scriptCount: productData.scriptCount,
      pageName: productData.pageData.name,
      pageBrand: productData.pageData.brand
    });
    
    // Process the extracted data
    const jsonLd = productData.jsonLd;
    const pageData = productData.pageData;
    
    // Clean price function
    const cleanPrice = (priceStr) => {
      if (!priceStr) return null;
      const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '');
      return parseFloat(cleaned) || null;
    };
    
    // Build final result
    const result = {
      url,
      name: jsonLd?.name || pageData.name || 'Unknown Product',
      brand: jsonLd?.brand?.name || pageData.brand || 'Unknown Brand',
      price: jsonLd?.offers?.price || cleanPrice(pageData.price) || 0,
      originalPrice: cleanPrice(pageData.originalPrice),
      currency: jsonLd?.offers?.priceCurrency || 'USD',
      description: jsonLd?.description || pageData.description || '',
      images: pageData.images?.length > 0 ? pageData.images : 
              (jsonLd?.image ? [jsonLd.image] : []),
      sizes: pageData.sizes || [],
      color: '',
      productId: jsonLd?.sku || jsonLd?.productID?.toString() || '',
      materials: [],
      inStock: pageData.inStock,
      source: 'ssense',
      scrapedAt: new Date().toISOString()
    };
    
    // Extract color from name
    if (result.name) {
      const colorMatch = result.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive)\b/i);
      if (colorMatch) {
        result.color = colorMatch[0];
      }
    }
    
    // Extract materials from description
    if (result.description) {
      const materialMatches = result.description.match(/(\d+%\s+\w+)/g);
      if (materialMatches) {
        result.materials = materialMatches;
      }
    }
    
    console.log('✅ Successfully scraped SSENSE product:', result.name);
    console.log('Price found:', result.price);
    console.log('Images found:', result.images.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error scraping SSENSE:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeSsense };