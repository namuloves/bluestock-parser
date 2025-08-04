const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeSaksFifthAvenue(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Saks Fifth Avenue...');
    
    // Check for proxy configuration
    const proxyArgs = [];
    if (process.env.USE_PROXY === 'true' || (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD)) {
      let proxyUrl;
      if (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD) {
        const username = encodeURIComponent(process.env.DECODO_USERNAME);
        const password = encodeURIComponent(process.env.DECODO_PASSWORD);
        proxyUrl = `gate.decodo.com:10001`;
        proxyArgs.push(`--proxy-server=http://${proxyUrl}`);
        console.log('🔐 Using Decodo proxy for Saks Fifth Avenue');
      }
    }
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        ...proxyArgs,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding',
        '--disable-accelerated-mjpeg-decode',
        '--disable-accelerated-video-decode',
        '--disable-app-list-dismiss-on-blur',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-canvas-aa',
        '--disable-client-side-phishing-detection',
        '--disable-cloud-import',
        '--disable-composited-antialiasing',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-features=TranslateUI',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-speech-api',
        '--disable-sync',
        '--disable-tab-for-desktop-share',
        '--disable-translate',
        '--disable-voice-input',
        '--disable-wake-on-wifi'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
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
    
    // Enhanced stealth settings for DataDome
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Rotate user agents
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    // Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      window.chrome = {
        runtime: {}
      };
      
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: () => Promise.resolve({ state: 'granted' })
        })
      });
    });
    
    console.log('📄 Navigating to Saks Fifth Avenue page...');
    
    // Add random delay before navigation (human-like behavior)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 90000 
    });
    
    console.log('Response status:', response.status());
    
    // Check for DataDome challenge
    const pageContent = await page.content();
    if (pageContent.includes('datadome') || pageContent.includes('captcha-delivery')) {
      console.log('⚠️ DataDome challenge detected, attempting to solve...');
      
      // Wait for potential redirect or challenge resolution
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Simulate human-like mouse movements
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 300);
      await page.mouse.move(500, 400);
      
      // Random scroll
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 100);
      });
      
      // Wait for challenge to potentially resolve
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Wait for product content to load
    try {
      await page.waitForSelector('[class*="product"], [class*="Product"], #product-content, .product-detail', { 
        timeout: 30000 
      });
    } catch (e) {
      console.log('⚠️ Product selectors not found immediately, continuing...');
    }
    
    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
      
      const getAttribute = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : null;
      };
      
      // Try to get JSON-LD structured data first
      let jsonLd = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Product' || (Array.isArray(data) && data.some(d => d['@type'] === 'Product'))) {
            jsonLd = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : data;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Extract from page elements - Saks specific selectors
      const result = {
        jsonLd: jsonLd,
        pageData: {
          // Product name - various possible selectors
          name: getText('h1') ||
                getText('h1[class*="product-name"]') || 
                getText('h1[class*="ProductName"]') ||
                getText('.product-detail__product-name') ||
                getText('[data-testid="product-name"]') ||
                getText('.product-overview__heading') ||
                getText('h1.product-title') ||
                getText('[itemprop="name"]'),
          
          // Brand name - look for actual brand text
          brand: (() => {
            // Try to get brand from product__brand class
            const brandEl = document.querySelector('.product__brand');
            if (brandEl) {
              const brandLink = brandEl.querySelector('a');
              if (brandLink) return brandLink.textContent.trim();
            }
            
            // Try cxds-titleBrand
            const titleBrand = document.querySelector('.cxds-titleBrand');
            if (titleBrand && titleBrand.textContent.trim()) {
              return titleBrand.textContent.trim();
            }
            
            // Fallback selectors
            return getText('[class*="product-brand"]') || 
                   getText('[class*="ProductBrand"]') ||
                   getText('.product-detail__brand-name') ||
                   getText('[data-testid="product-brand"]') ||
                   getText('a[class*="brand"]') ||
                   getText('[itemprop="brand"]') ||
                   getText('.product-overview__brand');
          })(),
          
          // Current price - get from product__price
          price: (() => {
            // Look for product__price that's not strikethrough
            const priceEls = document.querySelectorAll('.product__price:not(.strikethrough-price)');
            for (const el of priceEls) {
              const text = el.textContent.trim();
              if (text && text.includes('$')) {
                return text;
              }
            }
            
            // Fallback to any price element
            return getText('.product__price') ||
                   getText('[class*="price"]:not([class*="strikethrough"])') ||
                   getText('[class*="price-sales"]') || 
                   getText('[class*="ProductPrice"]') ||
                   getText('.product-pricing__price--sales') ||
                   getText('[data-testid="product-price"]') ||
                   getText('.price-sales') ||
                   getText('[class*="current-price"]') ||
                   getText('[itemprop="price"]');
          })(),
          
          // Original/list price - look for strikethrough price
          originalPrice: getText('.strikethrough-price') ||
                        getText('[class*="price-list"]') ||
                        getText('[class*="price-original"]') ||
                        getText('.product-pricing__price--list') ||
                        getText('[data-testid="product-original-price"]') ||
                        getText('.price-standard') ||
                        getText('[class*="was-price"]'),
          
          // Product description
          description: getText('[class*="product-description"]') ||
                      getText('[class*="ProductDescription"]') ||
                      getText('.product-detail__description') ||
                      getText('[data-testid="product-description"]') ||
                      getText('#product-description') ||
                      getText('[itemprop="description"]') ||
                      getText('.product-information'),
          
          // Get all image URLs
          images: (() => {
            const imageUrls = new Set();
            
            // Try various image selectors
            const selectors = [
              'img[class*="product-image"]',
              'img[class*="ProductImage"]',
              '.product-images img',
              '[data-testid="product-image"] img',
              '.product-detail__images img',
              '.product-gallery img',
              'picture img',
              '[class*="gallery"] img'
            ];
            
            selectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(img => {
                if (img.src && !img.src.includes('data:image')) {
                  imageUrls.add(img.src.split('?')[0]);
                }
                if (img.dataset.src) {
                  imageUrls.add(img.dataset.src.split('?')[0]);
                }
              });
            });
            
            return Array.from(imageUrls);
          })(),
          
          // Get sizes
          sizes: (() => {
            const sizes = [];
            
            // Try various size selectors
            const sizeSelectors = [
              '[class*="size-selector"] button:not([disabled])',
              '[class*="SizeSelector"] button:not([disabled])',
              '.product-sizes button:not([disabled])',
              '[data-testid="size-selector"] button:not([disabled])',
              '.size-attribute button:not([disabled])',
              'input[name*="size"] + label',
              '[class*="swatches"] [class*="size"]:not([class*="disabled"])'
            ];
            
            sizeSelectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(el => {
                const size = el.textContent.trim();
                if (size && !sizes.includes(size)) {
                  sizes.push(size);
                }
              });
            });
            
            return sizes;
          })(),
          
          // Get color options
          colors: (() => {
            const colors = [];
            
            const colorSelectors = [
              '[class*="color-selector"] button',
              '[class*="ColorSelector"] button',
              '.product-colors button',
              '[data-testid="color-selector"] button',
              '.color-attribute button',
              'input[name*="color"] + label',
              '[class*="swatches"] [class*="color"]'
            ];
            
            colorSelectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(el => {
                const color = el.getAttribute('aria-label') || 
                             el.getAttribute('title') || 
                             el.textContent.trim();
                if (color && !colors.includes(color)) {
                  colors.push(color);
                }
              });
            });
            
            return colors;
          })(),
          
          // Product ID/SKU
          productId: getAttribute('[data-product-id]', 'data-product-id') ||
                    getAttribute('[data-sku]', 'data-sku') ||
                    getText('[class*="product-id"]') ||
                    getText('[class*="style-num"]') ||
                    getText('[itemprop="sku"]'),
          
          // Check availability
          inStock: !document.querySelector('[class*="out-of-stock"]') && 
                   !document.querySelector('[class*="sold-out"]') &&
                   !getText('.product-availability')?.toLowerCase().includes('out of stock')
        },
        
        // Debug info
        hasJsonLd: !!jsonLd,
        scriptCount: scripts.length,
        bodyClasses: document.body.className,
        pageUrl: window.location.href
      };
      
      return result;
    });
    
    console.log('Debug info:', {
      hasJsonLd: productData.hasJsonLd,
      scriptCount: productData.scriptCount,
      pageUrl: productData.pageUrl,
      pageName: productData.pageData.name,
      pageBrand: productData.pageData.brand,
      imagesFound: productData.pageData.images.length,
      sizesFound: productData.pageData.sizes.length
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
      name: pageData.name || jsonLd?.name || 'Unknown Product',
      brand: pageData.brand || jsonLd?.brand?.name || jsonLd?.brand || 'Unknown Brand',
      price: cleanPrice(pageData.price) || jsonLd?.offers?.price || jsonLd?.offers?.lowPrice || 0,
      originalPrice: cleanPrice(pageData.originalPrice) || jsonLd?.offers?.highPrice,
      currency: jsonLd?.offers?.priceCurrency || 'USD',
      description: pageData.description || jsonLd?.description || '',
      images: pageData.images?.length > 0 ? pageData.images : 
              (jsonLd?.image ? (Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]) : []),
      sizes: pageData.sizes || [],
      color: pageData.colors?.[0] || '',
      colors: pageData.colors || [],
      productId: pageData.productId || jsonLd?.sku || jsonLd?.productID?.toString() || '',
      materials: [],
      inStock: pageData.inStock ?? (jsonLd?.offers?.availability?.includes('InStock') ?? true),
      source: 'saksfifthavenue',
      scrapedAt: new Date().toISOString()
    };
    
    // Extract materials from description
    if (result.description) {
      const materialPatterns = [
        /(\d+%\s+\w+)/g,
        /\b(cotton|polyester|wool|silk|linen|cashmere|leather|suede|nylon|rayon|spandex|elastane)\b/gi
      ];
      
      const materials = new Set();
      materialPatterns.forEach(pattern => {
        const matches = result.description.match(pattern);
        if (matches) {
          matches.forEach(m => materials.add(m));
        }
      });
      
      result.materials = Array.from(materials);
    }
    
    // Extract color from name if not found in color options
    if (!result.color && result.name) {
      const colorMatch = result.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive|burgundy|maroon|teal|coral|gold|silver|bronze)\b/i);
      if (colorMatch) {
        result.color = colorMatch[0];
      }
    }
    
    console.log('✅ Successfully scraped Saks Fifth Avenue product:', result.name);
    console.log('Price found:', result.price);
    console.log('Images found:', result.images.length);
    console.log('Sizes found:', result.sizes.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error scraping Saks Fifth Avenue:', error.message);
    console.error('Stack:', error.stack);
    
    // Return partial data if available
    return {
      url,
      name: 'Error loading product',
      brand: '',
      price: 0,
      currency: 'USD',
      description: '',
      images: [],
      sizes: [],
      color: '',
      productId: '',
      materials: [],
      inStock: false,
      source: 'saksfifthavenue',
      error: error.message,
      scrapedAt: new Date().toISOString()
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeSaksFifthAvenue };