const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const scrapeFreePeopleEnhanced = async (url) => {
  console.log('🌻 Starting Enhanced Free People scraper for:', url);

  let browser;
  try {
    const puppeteerArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ];

    // Add executable path for Railway/production environment
    const launchOptions = {
      headless: 'new',
      args: puppeteerArgs,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📄 Navigating to Free People page...');
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for product content
    await page.waitForSelector('h1, .c-product-meta__heading, [data-qa="product-name"]', { timeout: 10000 }).catch(() => {});

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract product data
    const productData = await page.evaluate(() => {
      const product = {
        name: '',
        price: '',
        originalPrice: '',
        description: '',
        images: [],
        brand: 'Free People',
        sizes: [],
        colors: [],
        materials: [],
        inStock: true
      };

      // Product name
      const nameElement = document.querySelector('h1.c-product-meta__heading') ||
                         document.querySelector('h1[data-qa="product-name"]') ||
                         document.querySelector('.product-name h1') ||
                         document.querySelector('h1');
      if (nameElement) {
        product.name = nameElement.textContent.trim();
      }

      // Price
      const priceElement = document.querySelector('.c-product-meta__current-price') ||
                          document.querySelector('[data-qa="product-price"]') ||
                          document.querySelector('.product-price .price-sales') ||
                          document.querySelector('.price-standard');
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }

      // Original price (if on sale)
      const originalPriceElement = document.querySelector('.c-product-meta__original-price') ||
                                   document.querySelector('.price-standard') ||
                                   document.querySelector('s.product-price');
      if (originalPriceElement && originalPriceElement !== priceElement) {
        const priceText = originalPriceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.originalPrice = `$${priceMatch[0]}`;
        }
      }

      // Images - collect all available
      const images = new Set();

      // Method 1: Direct images
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.fullSrc;

        // Filter for product images
        if (src && (src.includes('freepeople.com') || src.includes('urbanoutfitters.com') || src.includes('urbn.com')) &&
            !src.includes('placeholder') && !src.includes('loading') && !src.includes('icon')) {

          // Try to get high-res version
          let highResSrc = src;

          // Free People image patterns
          if (src.includes('?')) {
            // Remove existing parameters
            highResSrc = src.split('?')[0];
          }

          // Add high-res parameters
          if (!highResSrc.includes('$redesign')) {
            highResSrc = highResSrc.replace(/\$[^$]+\$/, '') + '?$redesign-pdp-opt$';
          }

          images.add(highResSrc);
        }
      });

      // Method 2: Picture sources
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset;
        if (srcset) {
          // Extract URLs from srcset
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            if (url && !url.includes('placeholder')) {
              images.add(url);
            }
          });
        }
      });

      // Method 3: Background images
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const style = el.getAttribute('style');
        const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          images.add(urlMatch[1]);
        }
      });

      product.images = Array.from(images).slice(0, 10);

      // Sizes
      document.querySelectorAll('.c-product-sizes__button, [data-qa*="size"], .size-button').forEach(btn => {
        const size = btn.textContent?.trim() || btn.getAttribute('aria-label');
        const isAvailable = !btn.disabled && !btn.classList.contains('disabled') && !btn.classList.contains('out-of-stock');

        if (size && isAvailable && !product.sizes.includes(size)) {
          product.sizes.push(size);
        }
      });

      // Colors
      document.querySelectorAll('.c-product-colors__button, [data-qa*="color"], .color-button').forEach(el => {
        const color = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim();
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });

      // Description
      const descElement = document.querySelector('.c-product-information__description') ||
                         document.querySelector('[data-qa="product-description"]') ||
                         document.querySelector('.product-description');
      if (descElement) {
        product.description = descElement.textContent.trim();
      }

      return product;
    });

    await browser.close();

    productData.url = url;

    // Remove empty fields
    Object.keys(productData).forEach(key => {
      if (productData[key] === '' || (Array.isArray(productData[key]) && productData[key].length === 0)) {
        delete productData[key];
      }
    });

    console.log(`✅ Successfully scraped Free People product: ${productData.name}`);
    console.log(`   Found ${productData.images?.length || 0} images`);

    return {
      success: true,
      product: productData
    };

  } catch (error) {
    console.error('❌ Free People enhanced scraping error:', error.message);
    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'Free People'
      }
    };
  }
};

module.exports = { scrapeFreePeopleEnhanced };