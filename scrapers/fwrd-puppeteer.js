const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const scrapeFWRDWithPuppeteer = async (url) => {
  console.log('🎭 Starting FWRD Puppeteer scraper for:', url);

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
    console.log('📄 Loading page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for product content
    await page.waitForSelector('h1, .product-title, [itemprop="name"]', { timeout: 10000 }).catch(() => {});

    // Extract product data
    const productData = await page.evaluate(() => {
      const product = {
        name: '',
        brand: '',
        price: '',
        originalPrice: '',
        description: '',
        images: [],
        sizes: [],
        colors: [],
        sku: '',
        category: ''
      };

      // Product name
      product.name = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('.product-title')?.textContent?.trim() ||
                     document.querySelector('[itemprop="name"]')?.textContent?.trim() || '';

      // Brand
      product.brand = document.querySelector('.product-brand')?.textContent?.trim() ||
                      document.querySelector('.designer-name')?.textContent?.trim() ||
                      document.querySelector('[itemprop="brand"]')?.textContent?.trim() || '';

      // Price
      const priceElement = document.querySelector('.product-price') ||
                          document.querySelector('.price-current') ||
                          document.querySelector('[itemprop="price"]');
      if (priceElement) {
        const priceText = priceElement.textContent;
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }

      // Original price
      const originalPriceElement = document.querySelector('.price-original') ||
                                   document.querySelector('.price-was') ||
                                   document.querySelector('span.strikethrough');
      if (originalPriceElement) {
        const originalText = originalPriceElement.textContent;
        const originalMatch = originalText.match(/[\d,]+\.?\d*/);
        if (originalMatch) {
          product.originalPrice = `$${originalMatch[0]}`;
        }
      }

      // Description
      product.description = document.querySelector('.product-description')?.textContent?.trim() ||
                           document.querySelector('.product-details')?.textContent?.trim() ||
                           document.querySelector('[itemprop="description"]')?.textContent?.trim() || '';

      // Images - collect all image URLs
      const imageSelectors = [
        '.product-images img',
        '.product-carousel img',
        '.product-gallery img',
        '[data-testid="product-image"] img',
        '.image-zoom img',
        'img[itemprop="image"]'
      ];

      const seenImages = new Set();
      imageSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(img => {
          let imgUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-zoom');
          if (imgUrl && !imgUrl.includes('placeholder') && !imgUrl.includes('loading')) {
            // Clean up the URL
            imgUrl = imgUrl.replace(/\?.*$/, ''); // Remove query params
            if (!seenImages.has(imgUrl)) {
              seenImages.add(imgUrl);
              product.images.push(imgUrl);
            }
          }
        });
      });

      // Try to find image data in scripts
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        const content = script.textContent;
        if (content && content.includes('images') && content.includes('fwrdassets')) {
          // Extract image URLs from script content
          const imageMatches = content.match(/https:\/\/[^"'\s]+fwrdassets[^"'\s]+\.jpg/gi);
          if (imageMatches) {
            imageMatches.forEach(url => {
              if (!seenImages.has(url)) {
                seenImages.add(url);
                product.images.push(url);
              }
            });
          }
        }
      });

      // Sizes
      document.querySelectorAll('.size-selector button, .size-option, select[name="size"] option').forEach(el => {
        const size = el.textContent?.trim();
        if (size && size !== 'Select Size' && !el.disabled && !el.classList.contains('disabled')) {
          product.sizes.push(size);
        }
      });

      // Colors
      document.querySelectorAll('.color-option, .color-selector button, [data-color]').forEach(el => {
        const color = el.getAttribute('data-color') ||
                     el.getAttribute('title') ||
                     el.textContent?.trim();
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });

      return product;
    });

    // Extract product code from URL for additional image generation
    const urlMatch = url.match(/\/([A-Z]+-[A-Z0-9]+)\//);
    const productCode = urlMatch ? urlMatch[1] : null;

    if (productCode && productData.images.length < 2) {
      // Add predictable FWRD image URLs
      const baseImageUrl = `https://is4.fwrdassets.com/images/p/fw/p/${productCode}`;
      for (let i = 1; i <= 6; i++) {
        const imageUrl = `${baseImageUrl}_V${i}.jpg`;
        if (!productData.images.includes(imageUrl)) {
          productData.images.push(imageUrl);
        }
      }
    }

    await browser.close();

    // Clean the data
    productData.url = url;
    productData.inStock = true;

    // Remove empty fields
    Object.keys(productData).forEach(key => {
      if (productData[key] === '' || (Array.isArray(productData[key]) && productData[key].length === 0)) {
        delete productData[key];
      }
    });

    console.log(`✅ Successfully scraped FWRD product: ${productData.name || 'Unknown'}`);
    console.log(`   Found ${productData.images?.length || 0} images`);

    return {
      success: true,
      product: productData
    };

  } catch (error) {
    console.error('❌ FWRD Puppeteer scraping error:', error.message);
    if (browser) {
      await browser.close();
    }
    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'FWRD'
      }
    };
  }
};

module.exports = { scrapeFWRDWithPuppeteer };