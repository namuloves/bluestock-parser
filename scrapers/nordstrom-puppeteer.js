const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function scrapeNordstromWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Nordstrom...');
    console.log('🔍 Memory usage:', process.memoryUsage());
    
    // Launch browser with optimized settings and stealth mode
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ],
      // For Docker environments
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Additional anti-detection measures
    await page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
    
    // Navigate to the page with more natural behavior
    console.log('📄 Navigating to Nordstrom page...');
    
    // First go to Nordstrom homepage
    await page.goto('https://www.nordstrom.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit to appear more human-like
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Then navigate to the product page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // Wait for product content to load
    console.log('⏳ Waiting for product content...');
    
    // Wait for the page to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to wait for common product elements
    try {
      await Promise.race([
        page.waitForSelector('h1', { timeout: 10000 }),
        page.waitForSelector('[data-element="product-title"]', { timeout: 10000 }),
        page.waitForSelector('.product-title', { timeout: 10000 }),
        page.waitForSelector('[class*="ProductTitle"]', { timeout: 10000 })
      ]);
    } catch (e) {
      console.log('⚠️ Could not find product title elements, continuing...');
    }

    // Wait for images to load - CRITICAL FOR NORDSTROM RACK
    try {
      // Wait for product image container
      await page.waitForSelector('img[src*="nordstrommedia.com"], img[src*="nordstromimage.com"]', { timeout: 10000 });
      console.log('✅ Found Nordstrom images');

      // Extra wait for lazy-loaded images
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e) {
      console.log('⚠️ Could not find Nordstrom images, continuing...');
    }

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're blocked
    const pageContentCheck = await page.content();
    if (pageContentCheck.includes('unusual activity') || pageContentCheck.includes('Access Denied')) {
      console.log('⚠️ Detected blocking page, attempting to wait it out...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Scroll down to trigger lazy loading of images and prices with human-like behavior
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await page.evaluate(() => {
      window.scrollTo({ top: 600, behavior: 'smooth' });
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Extract product data
    console.log('📊 Extracting product data...');
    
    // Debug: Log page title and URL
    const pageTitle = await page.title();
    const pageUrl = await page.url();
    console.log('📄 Page title:', pageTitle);
    console.log('📄 Page URL:', pageUrl);
    
    // Check if we're on a blocking page
    const pageContent = await page.content();
    if (pageTitle.includes('Access Denied') || 
        pageContent.includes('unusual activity') || 
        pageContent.includes('Access Denied') ||
        pageContent.includes('security check')) {
      console.log('⚠️ Nordstrom is blocking the request');
      
      // Return a specific error response
      return {
        name: 'Product temporarily unavailable',
        price: 'Unable to fetch price',
        originalPrice: null,
        images: [],
        description: 'Nordstrom is currently blocking automated requests. Please try again later or use a proxy service.',
        sizes: [],
        color: '',
        sku: url.match(/\/(\d+)$/)?.[1] || '',
        brand: 'Nordstrom',
        category: '',
        isOnSale: false,
        inStock: false,
        url: url,
        error: 'Blocked by anti-bot protection',
        blocked: true
      };
    }
    
    const productData = await page.evaluate(() => {
      // Helper function to get text content safely
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
      };
      
      // Helper function to get all matching elements
      const getAllText = (selector) => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0);
      };
      
      // Extract product name - h1 works on Nordstrom
      const name = getText('h1') || 
                   document.title.split('|')[0].trim();
      
      // Extract brand - first h2 is often the brand on Nordstrom
      const brand = getText('h2') ||
                    getText('[data-element="product-brand"]') ||
                    getText('.product-brand') ||
                    getText('[class*="ProductBrand"]') ||
                    getText('[class*="brand-name"]') ||
                    getText('a[href*="/browse/"]') ||
                    getText('[aria-label*="Brand"]') ||
                    'Nordstrom';
      
      // Extract price - look for any element containing dollar sign
      let priceText = '';
      const priceElements = document.querySelectorAll('*');
      for (let el of priceElements) {
        const text = el.textContent.trim();
        if (text.match(/^\$[\d,]+\.?\d*$/) && !el.querySelector('*')) {
          priceText = text;
          break;
        }
      }
      
      if (!priceText) {
        priceText = getText('[aria-label*="Price"]') ||
                    getText('.price-display-item') ||
                    getText('[class*="PriceDisplay"]') ||
                    getText('[class*="price-display"]') ||
                    getText('[class*="price"]:not([class*="original"]):not([class*="was"])') ||
                    '';
      }
      
      // Extract original price (for sale items)
      const originalPriceText = getText('[aria-label*="Original"]') ||
                                getText('.price-display-item--original') ||
                                getText('[class*="original-price"]') ||
                                '';
      
      // Extract images - Enhanced for Nordstrom Rack
      const images = [];
      const imageUrls = new Set(); // Use Set to avoid duplicates

      // Method 1: Check all img elements (including lazy-loaded)
      document.querySelectorAll('img').forEach(img => {
        // Check multiple possible attributes
        const possibleSrcs = [
          img.src,
          img.dataset.src,
          img.getAttribute('data-src'),
          img.getAttribute('data-lazy'),
          img.getAttribute('data-original')
        ];

        possibleSrcs.forEach(src => {
          if (src && (src.includes('nordstromimage.com') || src.includes('n.nordstrommedia.com') || src.includes('nordstromrack.com')) &&
              !src.includes('icon') && !src.includes('logo') && !src.includes('pixel') && !src.includes('tracking')) {
            // Convert to high resolution
            const highResSrc = src.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
            imageUrls.add(highResSrc);
          }
        });
      });
      
      // Method 2: Check srcset attributes (for responsive images)
      document.querySelectorAll('[srcset]').forEach(el => {
        const srcset = el.getAttribute('srcset');
        if (srcset && (srcset.includes('nordstromimage.com') || srcset.includes('n.nordstrommedia.com') || srcset.includes('nordstromrack.com'))) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            if (!url.includes('icon') && !url.includes('logo') && !url.includes('tracking')) {
              const highResSrc = url.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
              imageUrls.add(highResSrc);
            }
          });
        }
      });
      
      // Method 3: Check div backgrounds
      document.querySelectorAll('[style*="background-image"]').forEach(div => {
        const style = div.getAttribute('style');
        const match = style.match(/url\(["']?([^"'\)]+)["']?\)/);
        if (match && (match[1].includes('nordstromimage.com') || match[1].includes('n.nordstrommedia.com') || match[1].includes('nordstromrack.com'))) {
          const highResSrc = match[1].replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
          imageUrls.add(highResSrc);
        }
      });
      
      // Method 4: Check picture elements
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset || source.getAttribute('srcset');
        if (srcset && (srcset.includes('nordstromimage.com') || srcset.includes('n.nordstrommedia.com') || srcset.includes('nordstromrack.com'))) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            const highResSrc = url.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
            imageUrls.add(highResSrc);
          });
        }
      });

      // Method 5: Check data attributes that might contain image URLs
      document.querySelectorAll('[data-image], [data-images], [data-gallery]').forEach(el => {
        const dataValue = el.getAttribute('data-image') || el.getAttribute('data-images') || el.getAttribute('data-gallery');
        if (dataValue) {
          // Try to parse as JSON if it looks like JSON
          try {
            const parsed = JSON.parse(dataValue);
            const extractUrls = (obj) => {
              if (typeof obj === 'string' && obj.includes('nordstrom')) {
                const highResSrc = obj.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
                imageUrls.add(highResSrc);
              } else if (Array.isArray(obj)) {
                obj.forEach(extractUrls);
              } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(extractUrls);
              }
            };
            extractUrls(parsed);
          } catch (e) {
            // If not JSON, check if it's a direct URL
            if (dataValue.includes('nordstrom')) {
              const highResSrc = dataValue.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
              imageUrls.add(highResSrc);
            }
          }
        }
      });

      // Convert Set to Array and limit
      const uniqueImages = Array.from(imageUrls).slice(0, 15); // Get up to 15 images

      console.log(`Found ${uniqueImages.length} unique images`);
      
      // Extract sizes
      const sizes = getAllText('[aria-label*="size"]:not([disabled])') ||
                    getAllText('button[data-element*="size"]:not([disabled])') ||
                    getAllText('.size-selector button:not([disabled])');
      
      // Extract color
      const color = getText('[aria-label*="Color"]') ||
                    getText('.selected-color-name') ||
                    getText('[data-element*="color"]') ||
                    '';
      
      // Extract description
      const description = getText('[data-element="product-details"]') ||
                          getText('.product-details-description') ||
                          getText('[aria-label*="Details"]') ||
                          '';
      
      // Check if in stock
      const outOfStockElement = document.querySelector('.out-of-stock') ||
                                document.querySelector('[aria-label*="out of stock"]');
      const inStock = !outOfStockElement;
      
      // Extract SKU from URL or page
      const urlMatch = window.location.pathname.match(/\/(\d+)$/);
      const sku = urlMatch ? urlMatch[1] : '';
      
      return {
        name,
        brand,
        priceText,
        originalPriceText,
        images: uniqueImages, // Already limited to 15
        sizes,
        color,
        description,
        inStock,
        sku,
        url: window.location.href
      };
    });
    
    console.log('✅ Data extracted successfully');
    
    // Process the extracted data
    const priceMatch = productData.priceText?.match(/[\d,]+\.?\d*/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
    
    const originalPriceMatch = productData.originalPriceText?.match(/[\d,]+\.?\d*/);
    const originalPrice = originalPriceMatch ? parseFloat(originalPriceMatch[0].replace(',', '')) : null;
    
    const isOnSale = !!originalPrice && originalPrice > price;
    
    return {
      name: productData.name || 'Nordstrom Product',
      price: price ? `$${price}` : 'Price not available',
      originalPrice: originalPrice ? `$${originalPrice}` : null,
      images: productData.images,
      description: productData.description,
      sizes: productData.sizes,
      color: productData.color,
      sku: productData.sku,
      brand: productData.brand,
      category: '',
      isOnSale: isOnSale,
      inStock: productData.inStock,
      url: productData.url || url
    };
    
  } catch (error) {
    console.error('Nordstrom Puppeteer scraper error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Return minimal data on error
    return {
      name: 'Nordstrom Product',
      price: 'Price unavailable',
      originalPrice: null,
      images: [],
      description: 'Unable to fetch product details',
      sizes: [],
      color: '',
      sku: url.match(/\/(\d+)$/)?.[1] || '',
      brand: 'Nordstrom',
      category: 'Fashion',
      isOnSale: false,
      inStock: false,
      url: url,
      error: error.message
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeNordstromWithPuppeteer };