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
        const productImageUrls = new Set();

        // Get the SKU from JSON-LD if available
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        let jsonLdSku = null;
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'Product' && data.sku) {
              jsonLdSku = data.sku;
              break;
            }
          } catch (e) {
            // Continue
          }
        }

        if (!jsonLdSku) {
          console.error('Could not find product SKU');
          return [];
        }

        // Strategy 1: Extract from picture elements (SSENSE uses srcset)
        // Look for picture sources with the product SKU
        document.querySelectorAll('picture source, picture img').forEach(el => {
          const srcset = el.srcset || el.src;
          if (srcset && srcset.includes(jsonLdSku)) {
            // SSENSE srcset format is just a single URL (no "1x" or "2x" suffixes)
            // The URL contains Cloudinary parameters with commas, so don't split by comma
            if (srcset.includes('ssensemedia.com')) {
              // Clean the URL - remove any trailing whitespace or params after the file path
              const cleanUrl = srcset.trim().split(' ')[0];
              productImageUrls.add(cleanUrl);
            }
          }
        });

        // Strategy 2: Also check img elements with the SKU
        document.querySelectorAll('img').forEach(img => {
          if (img.src && img.src.includes('ssensemedia.com') && img.src.includes(jsonLdSku)) {
            productImageUrls.add(img.src.split('?')[0]);
          }
        });

        // Convert Set to Array and deduplicate by image number
        // SSENSE uses format: ...252814F095000_1/... where the number after _ is the image variant
        const finalImages = Array.from(productImageUrls);

        // Extract unique image numbers (e.g., _1, _2, _3, _4)
        const imagesByNumber = new Map();
        finalImages.forEach(url => {
          const match = url.match(new RegExp(`${jsonLdSku}_(\\d+)`));
          if (match) {
            const imageNumber = match[1];
            // Keep the highest quality version (f_auto,c_limit,h_2800)
            if (!imagesByNumber.has(imageNumber) || url.includes('h_2800')) {
              imagesByNumber.set(imageNumber, url);
            }
          }
        });

        // Sort by image number and return
        const sortedImages = Array.from(imagesByNumber.entries())
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([_, url]) => url);

        return sortedImages.slice(0, 15);
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

          description: getText('.pdp-product-description') ||
                      getText('.pdp-product-details__content') ||
                      getText('[class*="product-details"]') ||
                      getText('[class*="product-description"]') ||
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
      description: pageData.description || jsonLd?.description || '',
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
    
    // Extract materials and details from description
    if (result.description) {
      // Extract percentage-based materials (e.g., "100% cotton")
      const materialMatches = result.description.match(/(\d+%\s+\w+)/g);
      if (materialMatches) {
        result.materials = materialMatches;
      }

      // Extract specific material mentions (e.g., "950 sterling silver")
      const materialDetails = result.description.match(/\d+\s+sterling\s+silver/i);
      if (materialDetails && !result.materials.length) {
        result.materials = [materialDetails[0]];
      }

      // Extract origin information (e.g., "Made in Japan")
      const madeInMatch = result.description.match(/Made in ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
      if (madeInMatch) {
        result.origin = madeInMatch[1];
      }

      // Extract additional details like "Logo engraved at inner band"
      // First, remove the supplier color section and everything after it
      const cleanedDescription = result.description.split(/Supplier color:/i)[0];

      const detailLines = cleanedDescription
        .split(/\n|·/)
        .map(line => line.trim())
        .filter(line =>
          line.length > 0 &&
          !line.match(/^\d+%/) &&
          !line.match(/^Made in/i) &&
          !line.match(/^\d+\s+sterling/i) &&
          !line.match(/^\d{12,}$/) && // Filter out SKU numbers (12+ digits)
          line.length > 3 // Filter out very short lines
        );

      if (detailLines.length > 0) {
        result.details = detailLines;
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