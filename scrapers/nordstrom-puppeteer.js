const puppeteer = require('puppeteer');

async function scrapeNordstromWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Nordstrom...');
    console.log('🔍 Memory usage:', process.memoryUsage());
    
    // Launch browser with optimized settings
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
        '--disable-renderer-backgrounding'
      ],
      // For Docker environments
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Navigate to the page
    console.log('📄 Navigating to Nordstrom page...');
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
    
    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll down to trigger lazy loading of images and prices
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract product data
    console.log('📊 Extracting product data...');
    
    // Debug: Log page title and URL
    const pageTitle = await page.title();
    const pageUrl = await page.url();
    console.log('📄 Page title:', pageTitle);
    console.log('📄 Page URL:', pageUrl);
    
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
      
      // Extract images
      const images = [];
      
      // Try to get main product images - check all img elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.getAttribute('data-src');
        if (src && (src.includes('nordstromimage.com') || src.includes('n.nordstrommedia.com')) && 
            !src.includes('icon') && !src.includes('logo') && !src.includes('pixel')) {
          // Convert to high resolution
          const highResSrc = src.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
          if (!images.includes(highResSrc)) {
            images.push(highResSrc);
          }
        }
      });
      
      // Check srcset attributes
      document.querySelectorAll('[srcset]').forEach(el => {
        const srcset = el.getAttribute('srcset');
        if (srcset && (srcset.includes('nordstromimage.com') || srcset.includes('n.nordstrommedia.com'))) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            if (!url.includes('icon') && !url.includes('logo')) {
              const highResSrc = url.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
              if (!images.includes(highResSrc)) {
                images.push(highResSrc);
              }
            }
          });
        }
      });
      
      // Also check div backgrounds
      document.querySelectorAll('[style*="background-image"]').forEach(div => {
        const style = div.getAttribute('style');
        const match = style.match(/url\(["']?([^"'\)]+)["']?\)/);
        if (match && (match[1].includes('nordstromimage.com') || match[1].includes('n.nordstrommedia.com'))) {
          const highResSrc = match[1].replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
          if (!images.includes(highResSrc)) {
            images.push(highResSrc);
          }
        }
      });
      
      // Try picture elements
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset;
        if (srcset && srcset.includes('nordstromimage.com')) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            const highResSrc = url.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
            if (!images.includes(highResSrc)) {
              images.push(highResSrc);
            }
          });
        }
      });
      
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
        images: images.slice(0, 10), // Limit to 10 images
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