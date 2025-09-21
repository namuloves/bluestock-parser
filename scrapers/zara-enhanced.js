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

    console.log('🚀 Launching browser with options:', {
      headless: launchOptions.headless,
      hasExecutablePath: !!launchOptions.executablePath
    });

    browser = await puppeteer.launch(launchOptions);

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

    // Click on COMPOSITION & CARE tab to reveal material information
    console.log('🧵 Clicking composition tab to extract materials...');
    await page.evaluate(() => {
      // Find and click the composition button
      const compositionButtons = document.querySelectorAll('.product-detail-actions__action, button');
      for (const btn of compositionButtons) {
        if (btn.textContent?.includes('COMPOSITION') || btn.textContent?.includes('Composition')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Extract all available image URLs from various sources
    console.log('📸 Extracting images from page...');
    const imageData = await page.evaluate(() => {
      const images = new Set();
      const debug = { method1: 0, method2: 0, method3: 0, method4: 0 };

      // Method 1: Direct image elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.fullSrc || img.getAttribute('data-zoom');
        if (src && src.includes('static.zara.net') && !src.includes('placeholder')) {
          images.add(src);
          debug.method1++;
        }
      });

      // Method 2: Background images
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const style = el.getAttribute('style');
        const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1].includes('static.zara.net')) {
          images.add(urlMatch[1]);
          debug.method2++;
        }
      });

      // Method 3: Picture sources
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset;
        if (srcset && srcset.includes('static.zara.net')) {
          // Extract URLs from srcset
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            images.add(url);
            debug.method3++;
          });
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
            matches.forEach(url => {
              images.add(url);
              debug.method4++;
            });
          }
        }
      });

      console.log('Debug - Images found by method:', debug);
      return { images: Array.from(images), debug };
    });

    console.log('📸 Image extraction debug:', imageData.debug);
    const images = imageData.images || [];

    // Process image URLs to get high-resolution versions
    const processedImages = images.map(url => {
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

      // Colors - also check for selected color
      const selectedColorElement = document.querySelector('.product-detail-selected-color, .product-detail-color-selector__selected-color-name, [class*="selected-color"]');
      if (selectedColorElement) {
        const selectedColor = selectedColorElement.textContent?.trim();
        if (selectedColor && !product.colors.includes(selectedColor)) {
          product.colors.push(selectedColor);
        }
      }

      // Also get available colors
      const colorElements = document.querySelectorAll('.product-detail-color-selector__color, .color-selector a[aria-label]');
      colorElements.forEach(el => {
        const color = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim();
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });

      // Description
      const descElement = document.querySelector('.expandable-text__inner, .product-detail-info__description');
      if (descElement) {
        product.description = descElement.textContent.trim();
      }

      // Materials - check multiple possible locations including the composition panel
      let materialsFound = false;

      // First try to get from the composition panel that was opened
      const compositionPanel = document.querySelector('.product-detail-actions__action-product-composition, .product-composition-wrapper, [class*="composition-panel"]');
      if (compositionPanel) {
        const text = compositionPanel.textContent;
        const materials = text.match(/\d+%\s+[\w\s]+/g);
        if (materials && materials.length > 0) {
          product.materials = materials;
          materialsFound = true;
        }
      }

      // Also check for OUTER SHELL or similar sections
      if (!materialsFound) {
        const shellElements = document.querySelectorAll('li, p, div');
        for (const el of shellElements) {
          const text = el.textContent;
          if (text?.includes('OUTER SHELL') || text?.includes('COMPOSITION')) {
            // Get the next element or parent's text that contains percentages
            const parentText = el.parentElement?.textContent || '';
            const materials = parentText.match(/\d+%\s+[\w\s]+/g);
            if (materials && materials.length > 0) {
              product.materials = materials;
              materialsFound = true;
              break;
            }
          }
        }
      }

      // Fallback to any element containing percentages
      if (!materialsFound) {
        const allText = document.body.textContent;
        const materials = allText.match(/\d+%\s+(polyamide|polyester|cashmere|cotton|wool|silk|elastane|viscose|linen|acrylic|nylon|spandex)/gi);
        if (materials && materials.length > 0) {
          // Filter out duplicates and limit to reasonable number
          const uniqueMaterials = [...new Set(materials)];
          // Only take first 5 materials (to avoid picking up other products)
          product.materials = uniqueMaterials.slice(0, 5);
        }
      }

      return product;
    });

    await browser.close();

    // Combine all images and remove duplicates
    const allImages = [...new Set([...processedImages, ...additionalImages])];
    console.log(`📸 Total unique images before filtering: ${allImages.length}`);

    // Filter out non-product images (SVGs, icons, other products)
    const filteredImages = allImages.filter(url => {
      // Keep only JPG/PNG product images
      if (!url.match(/\.(jpg|jpeg|png)/i)) return false;

      // Filter out images that don't match the product ID (check for base product ID)
      // Zara uses formats like 05536126800, 05536126402 for the same product 05536126
      if (productId) {
        const baseProductId = productId.substring(0, 8); // Get first 8 digits
        if (!url.includes(baseProductId)) return false;
      }

      // Filter out placeholder and icon images
      if (url.includes('placeholder') || url.includes('icon') || url.includes('logo')) return false;

      return true;
    });

    // Sort images to prioritize main product views
    const sortedImages = filteredImages.sort((a, b) => {
      // First, prioritize images with product codes ending in 402 or 800 (main product lines)
      const aHasMain = a.includes('126402') || a.includes('126800');
      const bHasMain = b.includes('126402') || b.includes('126800');

      if (aHasMain && !bHasMain) return -1;
      if (!aHasMain && bHasMain) return 1;

      // Deprioritize URLs with /contents/ or /V/0/1/p/ or /I/0/1/p/ (alternate paths)
      const aIsAlternate = a.includes('/contents/') || a.includes('/V/0/1/p/') || a.includes('/I/0/1/p/');
      const bIsAlternate = b.includes('/contents/') || b.includes('/V/0/1/p/') || b.includes('/I/0/1/p/');

      if (!aIsAlternate && bIsAlternate) return -1;
      if (aIsAlternate && !bIsAlternate) return 1;

      // Prioritize specific view numbers (6 and 2 are usually model shots)
      const aMatch = a.match(/_(\d+)_1_1/);
      const bMatch = b.match(/_(\d+)_1_1/);

      if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1]);
        const bNum = parseInt(bMatch[1]);

        // Priority order: 6 (full model), 2 (model front), 1 (flat lay), then others
        const priority = [6, 2, 1, 3, 4, 5, 7, 8, 9];
        const aIndex = priority.indexOf(aNum);
        const bIndex = priority.indexOf(bNum);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        } else if (aIndex !== -1) {
          return -1;
        } else if (bIndex !== -1) {
          return 1;
        }

        return aNum - bNum;
      }

      return 0;
    });

    // Take top 10 images
    console.log(`📸 Images after filtering: ${sortedImages.length}`);
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