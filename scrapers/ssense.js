const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeSsense(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for SSENSE...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    
    console.log('📄 Navigating to SSENSE page...');
    
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());

    // Wait for the page to render
    await page.waitForSelector('body', { timeout: 10000 });

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll to trigger lazy loading of images
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    console.log('🔍 Extracting product data...');

    // Try to click on size dropdown if it exists
    await page.click('[class*="size-selector"]').catch(() => {});
    await page.click('[data-test*="size"]').catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 500));

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

      // Try to get JSON-LD first
      let jsonLd = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Product' || data.name) {
            jsonLd = data;
            break;
          }
        } catch (e) {
          // Continue to next script
        }
      }

      // Extract all image URLs - focus on product images
      const extractImages = () => {
        const images = [];
        const productImageUrls = new Set();

        // First, try to get the current product ID from the URL or page
        const productId = window.location.pathname.match(/\/(\d+)$/)?.[1];

        // Strategy 1: Look for main product image gallery
        // These are usually in a carousel or image viewer
        document.querySelectorAll('.pdp__image img, .product-image img, [class*="gallery"] img, [class*="carousel"] img').forEach(img => {
          if (img.src && img.src.includes('ssensemedia.com')) {
            // Only add if it contains the product ID or is clearly a product image
            if (!productId || img.src.includes(productId)) {
              productImageUrls.add(img.src.split('?')[0]);
            }
          }
        });

        // Strategy 2: Check picture elements for main product images
        document.querySelectorAll('picture img').forEach(img => {
          if (img.src && img.src.includes('ssensemedia.com')) {
            // Check if the image URL contains the product ID
            if (productId && img.src.includes(productId)) {
              productImageUrls.add(img.src.split('?')[0]);
            } else if (productImageUrls.size === 0) {
              // If we haven't found any product images yet, be less strict
              productImageUrls.add(img.src.split('?')[0]);
            }
          }
        });

        // Strategy 3: Check data attributes
        document.querySelectorAll('[data-src*="ssensemedia"]').forEach(el => {
          const src = el.getAttribute('data-src');
          if (src) {
            if (!productId || src.includes(productId)) {
              productImageUrls.add(src.split('?')[0]);
            }
          }
        });

        // Strategy 4: Look for thumbnails that might contain all product images
        document.querySelectorAll('.thumbnail img, [class*="thumb"] img').forEach(img => {
          if (img.src && img.src.includes('ssensemedia.com')) {
            // Convert thumbnail URL to full size
            const fullSizeSrc = img.src.replace(/_\d+x\d+/, '').split('?')[0];
            if (!productId || fullSizeSrc.includes(productId)) {
              productImageUrls.add(fullSizeSrc);
            }
          }
        });

        // Convert Set to Array and filter for unique product images
        let finalImages = Array.from(productImageUrls);

        // If we still have no images, fall back to any SSENSE images
        if (finalImages.length === 0) {
          document.querySelectorAll('img').forEach(img => {
            if (img.src && img.src.includes('ssensemedia.com')) {
              finalImages.push(img.src.split('?')[0]);
            }
          });
          // Limit to first 10 if using fallback
          finalImages = finalImages.slice(0, 10);
        }

        return finalImages;
      };

      // Extract sizes with multiple strategies
      const extractSizes = () => {
        const sizes = [];
        const availableSizes = [];

        // Strategy 1: Check for size dropdown (SSENSE uses select elements)
        const sizeDropdown = document.querySelector('#pdpSizeDropdown');
        if (sizeDropdown) {
          Array.from(sizeDropdown.options).forEach(option => {
            const text = option.text;
            if (text && text !== 'SELECT A SIZE') {
              // Parse the size from text like "IT 38 - Only 1 remaining" or "IT 35 - Sold Out"
              const sizeMatch = text.match(/^(IT|EU|US|UK)?\s*(\d+\.?\d*)/);
              if (sizeMatch) {
                const size = sizeMatch[0].trim();
                sizes.push(size);
                // Check if it's available (not sold out)
                if (!text.includes('Sold Out')) {
                  availableSizes.push(size);
                }
              }
            }
          });
        }

        // Strategy 2: Look for size buttons (fallback)
        if (sizes.length === 0) {
          document.querySelectorAll('button').forEach(button => {
            const text = button.textContent.trim();
            // Check if it looks like a size (numeric or standard size format)
            if (/^(IT|EU|US|UK)?\s*(3[5-9]|4[0-5])(\.\d)?$/.test(text) || // EU sizes 35-45
                /^(XS|S|M|L|XL|XXL|XXXL)$/.test(text)) { // Letter sizes
              if (!button.disabled && !button.classList.contains('disabled')) {
                sizes.push(text);
                availableSizes.push(text);
              }
            }
          });
        }

        // Strategy 3: Check specific size containers
        if (sizes.length === 0) {
          const sizeContainers = document.querySelectorAll('[class*="size"], [data-test*="size"]');
          sizeContainers.forEach(container => {
            container.querySelectorAll('button, span, div').forEach(el => {
              const text = el.textContent.trim();
              if (/^(IT|EU|US|UK)?\s*(3[5-9]|4[0-5])(\.\d)?$/.test(text) ||
                  /^(XS|S|M|L|XL|XXL|XXXL)$/.test(text)) {
                if (el.tagName === 'BUTTON' && !el.disabled) {
                  sizes.push(text);
                  availableSizes.push(text);
                } else if (el.tagName !== 'BUTTON') {
                  sizes.push(text);
                }
              }
            });
          });
        }

        // Return available sizes if found, otherwise all sizes
        return availableSizes.length > 0 ? [...new Set(availableSizes)] : [...new Set(sizes)];
      };

      // Extract from page elements
      const result = {
        jsonLd: jsonLd,
        pageData: {
          // Try multiple selectors for each field
          name: getText('.pdp-product-title__name') ||
                getText('h2.pdp-product-title__name') ||
                getText('[class*="product-title__name"]') ||
                getText('h2'),

          brand: getText('.pdp-product-title__brand') ||
                 getText('h1.pdp-product-title__brand') ||
                 getText('[class*="product-title__brand"]') ||
                 getText('a[href*="/designer"]') ||
                 getText('h1'),

          price: getText('.product-price__price') ||
                 getText('span.product-price__price') ||
                 getText('[class*="price__price"]:not([class*="original"])') ||
                 getText('[class*="price"]'),

          originalPrice: getText('[class*="original"]') ||
                        getText('[class*="crossed"]'),

          description: getText('.pdp-product-details__content') ||
                      getText('[class*="product-details"]') ||
                      getText('[class*="description"]'),

          // Get all image URLs using the new extraction method
          images: extractImages(),

          // Get sizes using the new extraction method
          sizes: extractSizes(),

          // Check availability
          inStock: !document.querySelector('[class*="sold-out"]') &&
                   !document.querySelector('[class*="out-of-stock"]')
        },

        // Debug info
        hasJsonLd: !!jsonLd,
        scriptCount: scripts.length,
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };

      return result;
    });
    
    console.log('Debug info:', {
      hasJsonLd: productData.hasJsonLd,
      scriptCount: productData.scriptCount,
      pageName: productData.pageData.name,
      pageBrand: productData.pageData.brand
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
      name: jsonLd?.name || pageData.name || 'Unknown Product',
      brand: jsonLd?.brand?.name || pageData.brand || 'Unknown Brand',
      price: jsonLd?.offers?.price || cleanPrice(pageData.price) || 0,
      originalPrice: cleanPrice(pageData.originalPrice),
      currency: jsonLd?.offers?.priceCurrency || 'USD',
      description: jsonLd?.description || pageData.description || '',
      images: pageData.images?.length > 0 ? pageData.images : 
              (jsonLd?.image ? [jsonLd.image] : []),
      sizes: pageData.sizes || [],
      color: '',
      productId: jsonLd?.sku || jsonLd?.productID?.toString() || '',
      materials: [],
      inStock: pageData.inStock,
      source: 'ssense',
      scrapedAt: new Date().toISOString()
    };
    
    // Extract color from name
    if (result.name) {
      const colorMatch = result.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive)\b/i);
      if (colorMatch) {
        result.color = colorMatch[0];
      }
    }
    
    // Extract materials from description
    if (result.description) {
      const materialMatches = result.description.match(/(\d+%\s+\w+)/g);
      if (materialMatches) {
        result.materials = materialMatches;
      }
    }
    
    console.log('✅ Successfully scraped SSENSE product:', result.name);
    console.log('Price found:', result.price);
    console.log('Images found:', result.images.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error scraping SSENSE:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeSsense };