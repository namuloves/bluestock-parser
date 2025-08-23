const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeFarfetchWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Farfetch...');
    
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
    
    console.log('📄 Navigating to Farfetch page...');
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());
    
    // Wait for the page to render
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for specific elements that indicate the page has loaded
    try {
      await page.waitForSelector('[data-component="ProductDescription"], [data-tstid="productDetails-description"], h1', { timeout: 10000 });
    } catch (e) {
      console.log('Warning: Could not find product description element');
    }
    
    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
      
      const getAttr = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : null;
      };
      
      // Try to get JSON-LD first
      let jsonLd = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Product' || (data['@graph'] && data['@graph'].find(item => item['@type'] === 'Product'))) {
            jsonLd = data['@type'] === 'Product' ? data : data['@graph'].find(item => item['@type'] === 'Product');
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
          // Brand - Multiple selectors
          brand: getText('[data-component="ProductBrandName"]') ||
                 getText('[data-tstid="productDetails-brand"]') ||
                 getText('h1[data-component="ProductDescription"] a') ||
                 getText('._d120b3 a') ||
                 getText('a[data-component="DesignerName"]') ||
                 getText('[data-testid="product-brand"]'),
          
          // Product name
          name: getText('[data-component="ProductDescription"] span:last-child') ||
                getText('[data-tstid="productDetails-description"]') ||
                getText('h1[data-component="ProductDescription"]')?.split('\n').pop()?.trim() ||
                getText('._3c3f42') ||
                getText('[data-testid="product-name"]'),
          
          // Price
          price: getText('[data-component="PriceLarge"]') ||
                 getText('[data-tstid="priceInfo-current"]') ||
                 getText('._ac3d1e') ||
                 getText('[data-component="Price"]'),
          
          originalPrice: getText('[data-component="PriceOriginal"]') ||
                        getText('[data-tstid="priceInfo-original"]') ||
                        getText('._1c7a96 s'),
          
          // Description
          description: getText('[data-component="TabProductDetails"] p') ||
                      getText('[data-tstid="productDetails-description"]') ||
                      getText('._b4693b'),
          
          // Color
          color: getText('[data-component="ColourName"]') ||
                 getText('[data-tstid="productDetails-color"]') ||
                 getText('._c0f09e'),
          
          // Images - Get all product images
          images: Array.from(document.querySelectorAll('[data-component="ProductImageCarousel"] img, [data-component="ProductImage"] img, ._7e6893 img, [data-testid="product-image"]'))
            .map(img => img.src || img.dataset.src || img.dataset.image)
            .filter(src => src && src.includes('http'))
            .map(src => src.replace(/\?.*$/, '').replace(/_\d+\./, '_1000.')),
          
          // Sizes
          sizes: Array.from(document.querySelectorAll('[data-component="SizeSelector"] button, [data-tstid^="sizeButton-"], ._65f6bb button'))
            .filter(btn => !btn.disabled && !btn.classList.contains('disabled') && !btn.classList.contains('_41eca7'))
            .map(btn => btn.textContent.trim() || btn.getAttribute('aria-label')?.replace('Size ', '').trim())
            .filter(size => size && size !== ''),
          
          // Additional details
          materials: getText('[data-component="Composition"]') ||
                    getText('[data-testid="product-composition"]'),
          
          productId: window.location.href.match(/item-(\d+)/)?.[1]
        },
        
        // Debug info
        hasJsonLd: !!jsonLd,
        scriptCount: scripts.length,
        pageTitle: document.title
      };
      
      return result;
    });
    
    console.log('Debug info:', {
      hasJsonLd: productData.hasJsonLd,
      scriptCount: productData.scriptCount,
      pageTitle: productData.pageTitle,
      brand: productData.pageData.brand,
      name: productData.pageData.name
    });
    
    // Process the extracted data
    const jsonLd = productData.jsonLd;
    const pageData = productData.pageData;
    
    // Clean price function
    const cleanPrice = (priceStr) => {
      if (!priceStr) return null;
      const match = priceStr.match(/[\d,]+(?:\.\d{2})?/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
      return null;
    };
    
    // Determine currency from price string
    const getCurrency = (priceStr) => {
      if (!priceStr) return 'USD';
      if (priceStr.includes('$')) return 'USD';
      if (priceStr.includes('£')) return 'GBP';
      if (priceStr.includes('€')) return 'EUR';
      if (priceStr.includes('¥')) return 'JPY';
      return 'USD';
    };
    
    // Build final result
    const result = {
      url,
      name: pageData.name || jsonLd?.name || 'Unknown Product',
      brand: pageData.brand || jsonLd?.brand?.name || jsonLd?.brand || 'Unknown Brand',
      price: cleanPrice(pageData.price) || jsonLd?.offers?.price || 0,
      originalPrice: cleanPrice(pageData.originalPrice),
      currency: getCurrency(pageData.price) || jsonLd?.offers?.priceCurrency || 'USD',
      description: pageData.description || jsonLd?.description || '',
      images: pageData.images?.length > 0 ? pageData.images : 
              (jsonLd?.image ? (Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]) : []),
      sizes: pageData.sizes || [],
      color: pageData.color || jsonLd?.color || '',
      productId: pageData.productId || jsonLd?.sku || '',
      materials: pageData.materials ? [pageData.materials] : [],
      inStock: pageData.sizes?.length > 0 || jsonLd?.offers?.availability?.includes('InStock'),
      source: 'farfetch',
      scrapedAt: new Date().toISOString()
    };
    
    // Clean up brand from name if it's included
    if (result.brand && result.name.startsWith(result.brand)) {
      result.name = result.name.replace(result.brand, '').trim();
    }
    
    // Extract color from name if not found
    if (!result.color && result.name) {
      const colorMatch = result.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive|orange|burgundy|maroon|gold|silver)\b/i);
      if (colorMatch) {
        result.color = colorMatch[0].toLowerCase();
      }
    }
    
    // Extract materials if found
    if (result.materials[0]) {
      const materialMatches = result.materials[0].match(/(\d+%\s+\w+(?:\s+\w+)?)/g);
      if (materialMatches) {
        result.materials = materialMatches;
      } else {
        result.materials = [];
      }
    }
    
    console.log('✅ Successfully scraped Farfetch product:', result.name);
    console.log('Brand:', result.brand);
    console.log('Price:', result.currency, result.price);
    console.log('Images found:', result.images.length);
    console.log('Sizes available:', result.sizes.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error scraping Farfetch with Puppeteer:', error.message);
    console.error('Stack:', error.stack);
    return {
      url,
      error: error.message,
      source: 'farfetch'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeFarfetchWithPuppeteer };