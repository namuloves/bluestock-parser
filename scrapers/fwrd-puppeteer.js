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

    // Navigate to the page with error handling
    console.log('📄 Loading page...');
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (navError) {
      console.log('⚠️ Navigation timeout, attempting to continue...');
      // Continue even if navigation times out - page might still be usable
    }

    // Wait for product content
    await page.waitForSelector('h1, .product-title, [itemprop="name"]', { timeout: 10000 }).catch(() => {});

    // Click on Details tab if present to load description
    await page.evaluate(() => {
      const detailsTab = document.querySelector('[data-tab-content=".pdp-details"]') ||
                        Array.from(document.querySelectorAll('.tabs__link')).find(el =>
                          el.textContent?.toLowerCase().includes('detail'));
      if (detailsTab) {
        detailsTab.click();
      }
    });

    // Wait for tab content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

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

      // Product name - clean up whitespace and newlines
      const nameElement = document.querySelector('h1') ||
                         document.querySelector('.product-title') ||
                         document.querySelector('[itemprop="name"]');
      if (nameElement) {
        product.name = nameElement.textContent.replace(/\s+/g, ' ').trim();
      }

      // Brand
      product.brand = document.querySelector('.product-brand')?.textContent?.trim() ||
                      document.querySelector('.designer-name')?.textContent?.trim() ||
                      document.querySelector('[itemprop="brand"]')?.textContent?.trim() || '';

      // Price - look for sale price first
      const salePriceElement = document.querySelector('.price__sale') ||
                              document.querySelector('[class*="price__sale"]') ||
                              document.querySelector('[class*="sale-price"]');
      const retailPriceElement = document.querySelector('.price__retail') ||
                                 document.querySelector('[class*="price__retail"]') ||
                                 document.querySelector('[class*="original-price"]');

      if (salePriceElement) {
        const priceText = salePriceElement.textContent;
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      } else if (retailPriceElement) {
        const priceText = retailPriceElement.textContent;
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      } else {
        // Fallback to any element with price
        const anyPriceElement = document.querySelector('span[class*="price"]') ||
                               document.querySelector('div[class*="price"]');
        if (anyPriceElement) {
          const priceText = anyPriceElement.textContent;
          const priceMatch = priceText.match(/[\d,]+\.?\d*/);
          if (priceMatch) {
            product.price = `$${priceMatch[0]}`;
          }
        }
      }

      // Original price (retail price when there's a sale)
      if (retailPriceElement && salePriceElement) {
        const originalText = retailPriceElement.textContent;
        const originalMatch = originalText.match(/[\d,]+\.?\d*/);
        if (originalMatch) {
          product.originalPrice = `$${originalMatch[0]}`;
        }
      }

      // Description - look specifically for the details tab content
      const detailsPanel = document.querySelector('.pdp-details') ||
                          document.querySelector('[data-tab-content-target=".pdp-details"]') ||
                          Array.from(document.querySelectorAll('.tabs__content'))
                            .find(el => el.querySelector('li')); // Details usually has list items

      if (detailsPanel) {
        const descText = detailsPanel.textContent?.replace(/\s+/g, ' ').trim();
        // Make sure it's actual product details (often contains material info)
        if (descText && (descText.includes('%') || descText.includes('Made in') ||
            descText.includes('clean') || descText.includes('wash'))) {
          product.description = descText;
        }
      }

      // If still no description, look for the first tab panel that isn't "Complete the Look"
      if (!product.description) {
        const tabPanels = document.querySelectorAll('.tabs__content');
        for (const panel of tabPanels) {
          const text = panel.textContent?.replace(/\s+/g, ' ').trim();
          if (text && !text.includes('PREVIOUS') && !text.includes('Complete') &&
              !text.includes('$') && text.length > 20) {
            product.description = text;
            break;
          }
        }
      }

      // Fallback to other description selectors
      if (!product.description) {
        product.description = document.querySelector('.product-description')?.textContent?.trim() ||
                             document.querySelector('.product-details')?.textContent?.trim() ||
                             document.querySelector('[itemprop="description"]')?.textContent?.trim() || '';
      }

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

      // Sizes - look for radio button labels (FWRD specific)
      document.querySelectorAll('input[type="radio"][name*="size"] + label').forEach(el => {
        const size = el.textContent?.trim();
        const radioInput = el.previousElementSibling;
        const isAvailable = !radioInput?.disabled && !el.classList.contains('disabled');

        if (size && size !== 'Select Size' && isAvailable) {
          product.sizes.push(size);
        }
      });

      // Fallback to other size selectors
      if (product.sizes.length === 0) {
        document.querySelectorAll('button[data-size], .size-button, [class*="SizeButton"], [data-testid*="size-button"]').forEach(el => {
          const size = el.getAttribute('data-size') || el.textContent?.trim();
          if (size && size !== 'Select Size' && !size.includes('Guide') && !size.includes('measurements') &&
              !el.disabled && !el.classList.contains('disabled')) {
            product.sizes.push(size);
          }
        });

        // Also check for select options
        document.querySelectorAll('select[name="size"] option, select[class*="size"] option').forEach(el => {
          const size = el.textContent?.trim();
          if (size && size !== 'Select Size' && !el.disabled) {
            product.sizes.push(size);
          }
        });
      }

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