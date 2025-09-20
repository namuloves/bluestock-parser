const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const scrapeZaraEnhanced = async (url) => {
  console.log('🛍️ Starting Enhanced Zara scraper for:', url);

  let browser;
  try {
    // Extract product ID from URL
    const productIdMatch = url.match(/p(\d+)\.html/);
    const productId = productIdMatch ? productIdMatch[1] : null;
    console.log('📦 Product ID:', productId);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'stylesheet'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('📄 Navigating to Zara page...');
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for images to load
    await page.waitForSelector('img', { timeout: 10000 }).catch(() => {});

    // Scroll to load lazy images
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click on image thumbnails to load all images
    await page.evaluate(() => {
      const thumbnails = document.querySelectorAll('.product-detail-thumbnail__image, .media-image__image--thumbnail, button[class*="thumbnail"]');
      thumbnails.forEach(thumb => thumb.click());
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract all available image URLs from various sources
    const imageData = await page.evaluate(() => {
      const images = new Set();

      // Method 1: Direct image elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.fullSrc || img.getAttribute('data-zoom');
        if (src && src.includes('static.zara.net') && !src.includes('placeholder')) {
          images.add(src);
        }
      });

      // Method 2: Background images
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const style = el.getAttribute('style');
        const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1].includes('static.zara.net')) {
          images.add(urlMatch[1]);
        }
      });

      // Method 3: Picture sources
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset;
        if (srcset && srcset.includes('static.zara.net')) {
          // Extract URLs from srcset
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => images.add(url));
        }
      });

      // Method 4: Check for Zara's media JSON in scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      scripts.forEach(script => {
        const content = script.textContent;
        if (content && content.includes('static.zara.net')) {
          // Extract image URLs from script content
          const urlPattern = /https:\/\/static\.zara\.net\/[^"'\s,]+\.(?:jpg|jpeg|png|webp)/gi;
          const matches = content.match(urlPattern);
          if (matches) {
            matches.forEach(url => images.add(url));
          }
        }
      });

      return Array.from(images);
    });

    // Process image URLs to get high-resolution versions
    const processedImages = imageData.map(url => {
      // Zara image URL patterns:
      // https://static.zara.net/photos//2024/V/0/1/p/5536/126/800/2/{w}x{h}/5536126800_1_1_1.jpg

      // Remove size parameters and get highest quality
      let highResUrl = url
        .replace(/\/w\/\d+/, '/w/1920')  // Width parameter
        .replace(/\/h\/\d+/, '/h/2880')  // Height parameter
        .replace(/\?w=\d+/, '?w=1920')   // Query param width
        .replace(/&h=\d+/, '&h=2880')    // Query param height
        .replace(/\/\d+x\d+\//, '/1920x2880/')  // Direct size in path
        .replace(/_\d+_\d+_\d+\./, '_1_1_1.')  // Reset to main view
        .replace(/\.jpg\?[^?]*$/, '.jpg?w=1920&h=2880&f=high'); // Ensure high quality params

      // If no size params found, add them
      if (!highResUrl.includes('1920') && !highResUrl.includes('2880')) {
        if (highResUrl.includes('?')) {
          highResUrl += '&w=1920&h=2880&f=high';
        } else {
          highResUrl += '?w=1920&h=2880&f=high';
        }
      }

      return highResUrl;
    });

    // Generate additional image URLs based on product ID pattern
    const additionalImages = [];
    if (productId) {
      // Zara typically has multiple views (_1_1_1, _2_1_1, etc.)
      for (let i = 1; i <= 8; i++) {
        // Try different URL patterns Zara uses
        const patterns = [
          `https://static.zara.net/photos//2024/V/0/1/p/${productId.substr(0, 4)}/${productId.substr(4)}/800/2/1920x2880/${productId}800_${i}_1_1.jpg`,
          `https://static.zara.net/photos//2024/I/0/1/p/${productId.substr(0, 4)}/${productId.substr(4)}/800/2/1920x2880/${productId}800_${i}_1_1.jpg`,
          `https://static.zara.net/photos//contents/2024/V/0/1/p/${productId.substr(0, 4)}/${productId.substr(4)}/800/2/${productId}800_${i}_1_1.jpg?w=1920&h=2880`,
        ];

        patterns.forEach(pattern => {
          if (!processedImages.includes(pattern)) {
            additionalImages.push(pattern);
          }
        });
      }
    }

    // Extract other product data
    const productData = await page.evaluate(() => {
      const product = {
        name: '',
        price: '',
        originalPrice: '',
        description: '',
        brand: 'Zara',
        sizes: [],
        colors: [],
        materials: [],
        inStock: true
      };

      // Product name
      const nameElement = document.querySelector('h1.product-detail-info__header-name, h1[class*="product"], h1');
      if (nameElement) {
        product.name = nameElement.textContent.trim();
      }

      // Price
      const priceElement = document.querySelector('.product-detail-info__price .price__amount-current, .money-amount__main, [class*="price"]:not([class*="old"])');
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = '$' + priceMatch[0];
        }
      }

      // Original price
      const originalPriceElement = document.querySelector('.price__amount-old, [class*="price"][class*="old"], .price-old');
      if (originalPriceElement) {
        const priceText = originalPriceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.originalPrice = '$' + priceMatch[0];
        }
      }

      // Sizes
      const sizeButtons = document.querySelectorAll('.size-selector__item button, .size-selector-list__item, [class*="size-selector"] li');
      sizeButtons.forEach(btn => {
        const size = btn.textContent?.trim() || btn.getAttribute('aria-label');
        const isAvailable = !btn.disabled && !btn.classList.contains('disabled');
        if (size && isAvailable && !product.sizes.includes(size)) {
          product.sizes.push(size);
        }
      });

      // Colors
      const colorElements = document.querySelectorAll('.product-detail-color-selector__color, .color-selector a[aria-label]');
      colorElements.forEach(el => {
        const color = el.getAttribute('aria-label') || el.getAttribute('title');
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });

      // Description
      const descElement = document.querySelector('.expandable-text__inner, .product-detail-info__description');
      if (descElement) {
        product.description = descElement.textContent.trim();
      }

      // Materials
      const compositionElement = document.querySelector('.product-detail-extra-info') ||
                                 Array.from(document.querySelectorAll('.structured-component__text'))
                                   .find(el => el.textContent.includes('COMPOSITION'));
      if (compositionElement) {
        const text = compositionElement.textContent;
        const materials = text.match(/\d+%\s+[\w\s]+/g);
        if (materials) {
          product.materials = materials;
        }
      }

      return product;
    });

    await browser.close();

    // Combine all images and remove duplicates
    const allImages = [...new Set([...processedImages, ...additionalImages])];

    // Filter out non-product images (SVGs, icons, other products)
    const filteredImages = allImages.filter(url => {
      // Keep only JPG/PNG product images
      if (!url.match(/\.(jpg|jpeg|png)/i)) return false;

      // Filter out images that don't match the product ID
      if (productId && !url.includes(productId)) return false;

      // Filter out placeholder and icon images
      if (url.includes('placeholder') || url.includes('icon') || url.includes('logo')) return false;

      return true;
    });

    // Sort images to prioritize main views
    const sortedImages = filteredImages.sort((a, b) => {
      // Prioritize _1_1_1 images (main view)
      if (a.includes('_1_1_1') && !b.includes('_1_1_1')) return -1;
      if (!a.includes('_1_1_1') && b.includes('_1_1_1')) return 1;

      // Then prioritize lower numbers (_2_1_1, _3_1_1, etc.)
      const aMatch = a.match(/_(\d)_1_1/);
      const bMatch = b.match(/_(\d)_1_1/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }

      return 0;
    });

    // Take top 10 images
    productData.images = sortedImages.slice(0, 10);
    productData.productId = productId;
    productData.url = url;

    console.log(`✅ Successfully scraped Zara product: ${productData.name}`);
    console.log(`   Found ${productData.images.length} high-res images`);
    console.log(`   Sizes: ${productData.sizes.join(', ')}`);

    return {
      success: true,
      product: productData
    };

  } catch (error) {
    console.error('❌ Zara enhanced scraping error:', error.message);
    if (browser) {
      await browser.close();
    }

    // Return with fallback data
    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'Zara',
        productId: url.match(/p(\d+)\.html/)?.[1] || '',
        name: 'Zara Product',
        images: []
      }
    };
  }
};

module.exports = { scrapeZaraEnhanced };