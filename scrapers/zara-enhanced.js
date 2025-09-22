const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const scrapeZaraEnhanced = async (url) => {
  console.log('🛍️ Starting Enhanced Zara scraper for:', url);

  let browser;
  try {
    // Extract product ID and variant from URL
    const productIdMatch = url.match(/p(\d+)\.html/);
    const productId = productIdMatch ? productIdMatch[1] : null;

    // Extract v1 parameter which indicates the specific variant
    const v1Match = url.match(/v1=(\d+)/);
    const v1Param = v1Match ? v1Match[1] : null;

    console.log('📦 Product ID:', productId);
    console.log('📦 Variant (v1):', v1Param);

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

    // Determine the likely variant code from v1 parameter
    let preferredVariant = null;
    if (v1Param) {
      // v1 parameter often contains variant info - last 3 digits often match variant
      // For example: 487007982 might correspond to variant 402
      // We'll check for common patterns
      if (v1Param.endsWith('982') || v1Param.includes('402')) {
        preferredVariant = '402';
      } else if (v1Param.endsWith('684')) {
        preferredVariant = '684';
      }
      // You can add more variant mappings as needed
    }

    console.log('🎯 Preferred variant:', preferredVariant || '402 (default for gingham)');

    // Generate additional image URLs based on product ID pattern
    const additionalImages = [];
    if (productId) {
      // Determine variant code to use
      const variantCode = preferredVariant || '402'; // Default to 402 for gingham

      // Zara typically has multiple views (_1_1_1, _2_1_1, etc.)
      // Model photos are usually _2_, _3_, _4_, _6_, _15_
      const imageNumbers = [6, 2, 3, 4, 15, 1, 5, 7, 8, 9];

      for (const imageNum of imageNumbers) {
        // Build the primary URL pattern for this variant
        const primaryPattern = `https://static.zara.net/photos//2024/V/0/1/p/${productId.substr(0, 4)}/${productId.substr(4)}/${variantCode}/2/1920x2880/${productId}${variantCode}_${imageNum}_1_1.jpg`;

        if (!processedImages.includes(primaryPattern)) {
          additionalImages.push(primaryPattern);
        }

        // Only add fallback pattern if we're not getting enough images
        if (additionalImages.length < 5) {
          const fallbackPattern = `https://static.zara.net/photos//2024/V/0/1/p/${productId.substr(0, 4)}/${productId.substr(4)}/800/2/1920x2880/${productId}800_${imageNum}_1_1.jpg`;
          if (!processedImages.includes(fallbackPattern)) {
            additionalImages.push(fallbackPattern);
          }
        }
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

      // Colors - check for color in product info section (format: "COLOR | SKU")
      const colorInfoElement = document.querySelector('.product-detail-info__color, .product-color-extended-name, p.product-color-extended-name');
      if (colorInfoElement) {
        const colorText = colorInfoElement.textContent?.trim();
        if (colorText) {
          // Extract color name from format like "TURQUOISE | 5536/126/402"
          const colorName = colorText.split('|')[0]?.trim();
          if (colorName && !product.colors.includes(colorName)) {
            product.colors.push(colorName);
          }
        }
      }

      // Also check for selected color
      const selectedColorElement = document.querySelector('.product-detail-selected-color, .product-detail-color-selector__selected-color-name, [class*="selected-color"]');
      if (selectedColorElement) {
        const selectedColor = selectedColorElement.textContent?.trim();
        if (selectedColor && !product.colors.includes(selectedColor)) {
          product.colors.push(selectedColor);
        }
      }

      // Also get available colors from color selector
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
      // Zara uses formats like 09479258800, 09479258402 for the same product 09479258
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
      // First priority: Check if image matches preferred variant
      if (preferredVariant) {
        const fullVariant = productId.substring(0, 8) + preferredVariant;
        const aHasPreferred = a.includes(fullVariant);
        const bHasPreferred = b.includes(fullVariant);

        if (aHasPreferred && !bHasPreferred) return -1;
        if (!aHasPreferred && bHasPreferred) return 1;
      }

      // Second priority: Model photos (images with specific view numbers)
      const aMatch = a.match(/_(\d+)_\d+_\d+\./);
      const bMatch = b.match(/_(\d+)_\d+_\d+\./);

      if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1]);
        const bNum = parseInt(bMatch[1]);

        // Priority order for image numbers:
        // 6 (full body model), 2 (model front), 3 (model back), 4 (model side),
        // 15 (model detail), 1 (flat lay), then others
        const modelPriority = [6, 2, 3, 4, 15, 1, 5, 7, 8, 9, 10, 11, 12, 13, 14];
        const aIndex = modelPriority.indexOf(aNum);
        const bIndex = modelPriority.indexOf(bNum);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        } else if (aIndex !== -1) {
          return -1;
        } else if (bIndex !== -1) {
          return 1;
        }
      } else if (aMatch && !bMatch) {
        return -1; // Prioritize images with view numbers
      } else if (!aMatch && bMatch) {
        return 1;
      }

      // Third priority: Deprioritize duplicate paths
      const aIsAlternate = a.includes('/contents/') || a.includes('/I/0/1/p/');
      const bIsAlternate = b.includes('/contents/') || b.includes('/I/0/1/p/');

      if (!aIsAlternate && bIsAlternate) return -1;
      if (aIsAlternate && !bIsAlternate) return 1;

      // Fourth priority: Prefer images ending in 402 (common for gingham variant)
      const aHas402 = a.includes('402');
      const bHas402 = b.includes('402');

      if (aHas402 && !bHas402) return -1;
      if (!aHas402 && bHas402) return 1;

      return 0;
    });

    // Remove duplicates based on image number and variant
    // Keep only one version of each image (prefer /V/ over /I/ path)
    const uniqueImages = [];
    const seenImageKeys = new Set();

    sortedImages.forEach(url => {
      // Extract image identifier (product+variant+imagenum)
      const match = url.match(/(\d{8}\d{3})_(\d+)_\d+_\d+\./);
      if (match) {
        const imageKey = `${match[1]}_${match[2]}`;
        if (!seenImageKeys.has(imageKey)) {
          seenImageKeys.add(imageKey);
          uniqueImages.push(url);
        }
      } else {
        // Keep non-standard format images
        uniqueImages.push(url);
      }
    });

    // Take top 10 unique images
    console.log(`📸 Images after filtering and deduplication: ${uniqueImages.length}`);
    productData.images = uniqueImages.slice(0, 10);
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