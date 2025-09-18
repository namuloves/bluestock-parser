const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const scrapeMiuMiuWithPuppeteer = async (url) => {
  console.log('🎭 Starting Miu Miu Puppeteer scraper for:', url);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-blink-features=AutomationControlled'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the page
    console.log('📄 Loading Miu Miu page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for product content
    await page.waitForSelector('h1, .product-name, [itemprop="name"]', { timeout: 10000 }).catch(() => {});

    // Wait for price to load (often loads after initial page)
    await page.waitForSelector('[class*="price"], [data-price], [itemprop="price"]', { timeout: 10000 }).catch(() => {});

    // Wait a bit more for all dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract product code from URL
    const urlMatch = url.match(/\/([A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*)/);
    const productCode = urlMatch ? urlMatch[1] : null;

    // Extract product data
    const productData = await page.evaluate((sku) => {
      const product = {
        name: '',
        brand: 'Miu Miu',
        price: '',
        originalPrice: '',
        description: '',
        images: [],
        sizes: [],
        colors: [],
        material: '',
        category: '',
        sku: sku || ''
      };

      // Product name
      product.name = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('.product-name')?.textContent?.trim() ||
                     document.querySelector('[itemprop="name"]')?.textContent?.trim() ||
                     document.querySelector('.product-title')?.textContent?.trim() || '';

      // Price extraction - try multiple approaches
      const priceSelectors = [
        '.product-price',
        '.price-sales',
        '[data-price]',
        '.product-price-value',
        '[itemprop="price"]',
        '.price',
        '[data-testid="price"]',
        '.pdp-price',
        '.product-detail-price',
        'span[class*="price"]',
        'div[class*="price"]'
      ];

      // First, try to find any element containing currency symbols
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.textContent?.trim();
        if (text && (text.includes('€') || text.includes('$') || text.includes('£'))) {
          // Check if it's a price pattern - improved regex to capture full price
          // Match currency followed by any combination of digits, commas, and optional decimals
          // Use lookahead to ensure we get all consecutive digits
          const pricePattern = /[€$£]\s*([\d,]+(?:\.\d{1,2})?)/;
          const priceMatch = text.match(pricePattern);
          if (priceMatch && !product.price) {
            // Get the full price including currency
            const fullPrice = priceMatch[0];

            // Also try to extract just after the currency to ensure we get all digits
            const currencySymbol = fullPrice.match(/[€$£]/)[0];
            const numbersAfter = text.split(currencySymbol)[1];
            if (numbersAfter) {
              const numberMatch = numbersAfter.match(/^\s*([\d,]+(?:\.\d{1,2})?)/);
              if (numberMatch) {
                product.price = currencySymbol + numberMatch[1];
                console.log('Found price via currency search (method 2):', product.price);
                break;
              }
            }

            product.price = fullPrice;
            console.log('Found price via currency search (method 1):', product.price);
            break;
          }
        }
      }

      // Fallback to selectors
      if (!product.price) {
        for (const selector of priceSelectors) {
          const priceElement = document.querySelector(selector);
          if (priceElement) {
            const priceText = priceElement.textContent?.trim() || priceElement.getAttribute('data-price');
            if (priceText) {
              // First try to find price with currency symbol
              let priceMatch = priceText.match(/[€$£]\s*[\d,]{1,}(?:\.\d{1,2})?/);
              if (priceMatch) {
                product.price = priceMatch[0];
                console.log('Found price via selector with currency:', product.price);
                break;
              }
              // If no currency symbol, extract just the numbers
              // Make sure to capture all consecutive digits with commas
              priceMatch = priceText.match(/[\d,]{1,}(?:\.\d{1,2})?/);
              if (priceMatch) {
                product.price = priceMatch[0];
                console.log('Found price via selector (numbers only):', product.price);
                break;
              }
            }
          }
        }
      }

      // Check for price in meta tags
      if (!product.price) {
        const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="product:price:amount"]')?.getAttribute('content');
        if (metaPrice) {
          product.price = metaPrice;
        }
      }

      // Description
      product.description = document.querySelector('.product-description')?.textContent?.trim() ||
                           document.querySelector('.product-details')?.textContent?.trim() ||
                           document.querySelector('[itemprop="description"]')?.textContent?.trim() ||
                           document.querySelector('.description-content')?.textContent?.trim() || '';

      // Images - collect ONLY product-specific image URLs
      const imageSelectors = [
        '.product-image img',
        '.product-gallery img',
        '.product-images img',
        '.product-carousel img',
        '.pdp-images img',  // Product detail page images
        '.pdp-carousel img',
        '[data-testid="product-image"] img',
        '.main-image img',
        'img[itemprop="image"]'
      ];

      const seenImages = new Set();
      const baseImageUrls = new Map(); // Track base images to avoid duplicates

      // Helper function to extract base image URL (without size suffix)
      const getBaseImageUrl = (url) => {
        // Remove resolution suffixes like _1000.1000.jpg, _2000.2000.jpg
        // Also remove _SLF, _MDF, _SLR suffixes (different views)
        const base = url.replace(/\/cq5dam\.web\.[^\/]+\.\d+\.\d+\.jpg$/, '')
                       .replace(/\/_jcr_content\/renditions.*$/, '');
        return base;
      };

      // First try to get images that contain the product SKU in the URL
      if (sku) {
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && src.includes(sku.split('_')[0])) {  // Use first part of SKU
            const cleanUrl = src.split('?')[0];

            // Get the base image URL
            const baseUrl = getBaseImageUrl(cleanUrl);

            // Check if this is a main product image (contains specific view suffixes)
            if (cleanUrl.includes('_SLF') || cleanUrl.includes('_MDF') || cleanUrl.includes('_SLR') ||
                cleanUrl.includes('_MDR') || cleanUrl.includes('_SLD') || cleanUrl.includes('_MDD')) {

              // Only add if we haven't seen this base image
              if (!baseImageUrls.has(baseUrl)) {
                baseImageUrls.set(baseUrl, cleanUrl);
                // Use the highest quality version available
                const highQualityUrl = cleanUrl.includes('/_jcr_content/renditions/')
                  ? cleanUrl.replace(/\.\d+\.\d+\.jpg$/, '.2400.2400.jpg')
                  : cleanUrl;
                product.images.push(highQualityUrl);
              }
            }
          }
        });
      }

      // If no SKU-specific images found, try selectors
      if (product.images.length === 0) {
        imageSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(img => {
          let imgUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (imgUrl && !imgUrl.includes('placeholder') && !imgUrl.includes('loading') && !imgUrl.includes('data:image')) {
            // Ensure full URL
            if (!imgUrl.startsWith('http')) {
              imgUrl = new URL(imgUrl, window.location.origin).href;
            }
            // Clean up the URL
            imgUrl = imgUrl.split('?')[0]; // Remove query params
            if (!seenImages.has(imgUrl)) {
              seenImages.add(imgUrl);
              product.images.push(imgUrl);
            }
          }
        });
      });
      }

      // Don't extract from srcset as it creates duplicates
      // We already have the high-quality versions from above

      // Try to find additional unique images in scripts
      if (sku) {
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
          const content = script.textContent;
          if (content && content.includes(sku.split('_')[0])) {
            // Extract image URLs from script content
            const imageMatches = content.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi);
            if (imageMatches) {
              imageMatches.forEach(url => {
                const cleanUrl = url.split('?')[0];
                const baseUrl = getBaseImageUrl(cleanUrl);

                // Only add if it's a product image we haven't seen
                if (cleanUrl.includes(sku.split('_')[0]) && !baseImageUrls.has(baseUrl)) {
                  baseImageUrls.set(baseUrl, cleanUrl);
                  const highQualityUrl = cleanUrl.includes('/_jcr_content/renditions/')
                    ? cleanUrl.replace(/\.\d+\.\d+\.jpg$/, '.2400.2400.jpg')
                    : cleanUrl;
                  product.images.push(highQualityUrl);
                }
              });
            }
          }
        });
      }

      // Sizes
      document.querySelectorAll('.size-selector button, .size-option, select[name="size"] option, [data-size]').forEach(el => {
        const size = el.textContent?.trim() || el.value || el.getAttribute('data-size');
        if (size && size !== 'Select Size' && !el.disabled && !el.classList.contains('disabled')) {
          if (!product.sizes.includes(size)) {
            product.sizes.push(size);
          }
        }
      });

      // Colors
      document.querySelectorAll('.color-option, .color-selector button, [data-color]').forEach(el => {
        const color = el.getAttribute('data-color') ||
                     el.getAttribute('title') ||
                     el.getAttribute('aria-label') ||
                     el.textContent?.trim();
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });

      // Material
      product.material = document.querySelector('.product-material')?.textContent?.trim() ||
                        document.querySelector('.material-content')?.textContent?.trim() ||
                        document.querySelector('.product-composition')?.textContent?.trim() || '';

      // Category from breadcrumbs
      const breadcrumbs = document.querySelectorAll('.breadcrumb a, nav[aria-label="breadcrumb"] a, .breadcrumbs a');
      breadcrumbs.forEach(breadcrumb => {
        const text = breadcrumb.textContent?.trim();
        if (text && !text.toLowerCase().includes('home') && !text.toLowerCase().includes('miu miu')) {
          product.category = text;
        }
      });

      return product;
    }, productCode);

    await browser.close();

    // Format price with currency if needed
    if (productData.price && !productData.price.includes('€') && !productData.price.includes('$')) {
      // Default to EUR for Miu Miu
      productData.price = `€${productData.price}`;
    }

    // Ensure price formatting is preserved
    console.log('Final extracted price:', productData.price);

    // Clean the data
    productData.url = url;
    productData.inStock = true;

    // Remove empty fields
    Object.keys(productData).forEach(key => {
      if (productData[key] === '' || (Array.isArray(productData[key]) && productData[key].length === 0)) {
        delete productData[key];
      }
    });

    console.log(`✅ Successfully scraped Miu Miu product with Puppeteer: ${productData.name || 'Unknown'}`);
    console.log(`   Found ${productData.images?.length || 0} images`);
    console.log(`   Price: ${productData.price || 'Not found'}`);

    return {
      success: true,
      product: productData
    };

  } catch (error) {
    console.error('❌ Miu Miu Puppeteer scraping error:', error.message);
    if (browser) {
      await browser.close();
    }
    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'Miu Miu'
      }
    };
  }
};

module.exports = { scrapeMiuMiuWithPuppeteer };