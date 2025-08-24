const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeFarfetchWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer for Farfetch...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
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
    
    console.log('📄 Navigating to Farfetch page...');
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());
    
    // Wait for the page to render
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for specific elements that indicate the page has loaded
    try {
      await page.waitForSelector('[data-component="ProductDescription"], [data-tstid="productDetails-description"], h1', { timeout: 10000 });
    } catch (e) {
      console.log('Warning: Could not find product description element');
    }
    
    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Extracting product data...');
    
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
      
      const getAttr = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : null;
      };
      
      // Try to get JSON-LD first - Farfetch uses ProductGroup
      let jsonLd = null;
      let productGroup = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Product') {
            jsonLd = data;
          } else if (data['@type'] === 'ProductGroup') {
            productGroup = data;
          } else if (data['@graph']) {
            const product = data['@graph'].find(item => item['@type'] === 'Product');
            const group = data['@graph'].find(item => item['@type'] === 'ProductGroup');
            if (product) jsonLd = product;
            if (group) productGroup = group;
          }
        } catch (e) {
          // Continue to next script
        }
      }
      
      // Extract from H1 for brand and name
      let brand = null;
      let name = null;
      const h1 = document.querySelector('h1');
      if (h1) {
        const h1Text = h1.textContent.trim();
        const brandLink = h1.querySelector('a');
        if (brandLink) {
          brand = brandLink.textContent.trim();
          name = h1Text.replace(brand, '').trim();
        } else {
          name = h1Text;
        }
      }
      
      // Look for price in various locations
      let priceText = null;
      let originalPriceText = null;
      
      // Check for price patterns in the page
      const priceElements = document.querySelectorAll('span, div, p');
      for (const el of priceElements) {
        const text = el.textContent.trim();
        // Match currency followed by numbers
        if (text.match(/^[$£€¥]\s*[\d,]+(?:\.\d{2})?$/) && !priceText) {
          // Check if this is original price (usually has strikethrough)
          const hasStrike = el.tagName === 'S' || el.style.textDecoration === 'line-through' || 
                           el.parentElement?.tagName === 'S' || el.parentElement?.style.textDecoration === 'line-through';
          
          if (hasStrike) {
            originalPriceText = text;
          } else {
            priceText = text;
          }
        }
      }
      
      // Extract sizes from ProductGroup variants if available
      let sizes = [];
      let price = null;
      let currency = null;
      
      if (productGroup && productGroup.hasVariant) {
        productGroup.hasVariant.forEach(variant => {
          if (variant.size && !sizes.includes(variant.size)) {
            sizes.push(variant.size);
          }
          if (!price && variant.offers) {
            if (variant.offers.price) {
              price = parseFloat(variant.offers.price);
              currency = variant.offers.priceCurrency;
            }
          }
        });
      }
      
      // Get images from ProductGroup or img tags
      let images = [];
      if (productGroup && productGroup.image) {
        images = productGroup.image.map(img => {
          if (typeof img === 'string') return img;
          if (img.contentUrl) return img.contentUrl;
          return null;
        }).filter(Boolean);
      }
      
      if (images.length === 0) {
        images = Array.from(document.querySelectorAll('img[src*="cdn-images.farfetch"]'))
          .map(img => img.src)
          .filter(src => src && !src.includes('data:image'))
          .slice(0, 10); // Limit to 10 images
      }
      
      // Extract from page elements
      const result = {
        jsonLd: jsonLd,
        productGroup: productGroup,
        pageData: {
          // Use extracted brand and name
          brand: brand,
          name: name,
          
          // Price
          price: priceText,
          originalPrice: originalPriceText,
          
          // Description - try multiple selectors
          description: getText('[data-component="TabProductDetails"] p') ||
                      getText('[data-tstid="productDetails-description"]') ||
                      getText('div[class*="accordion"] div[class*="panel"]') ||
                      getText('._b4693b'),
          
          // Color
          color: getText('[data-component="ColourName"]') ||
                 getText('[data-tstid="productDetails-color"]') ||
                 getText('span[class*="color"]') ||
                 getText('._c0f09e'),
          
          // Images
          images: images,
          
          // Sizes
          sizes: sizes,
          
          // Additional details
          materials: getText('[data-component="Composition"]') ||
                    getText('[data-testid="product-composition"]'),
          
          productId: window.location.href.match(/item-(\d+)/)?.[1],
          
          // Extracted price and currency
          extractedPrice: price,
          extractedCurrency: currency
        },
        
        // Debug info
        hasJsonLd: !!jsonLd,
        hasProductGroup: !!productGroup,
        scriptCount: scripts.length,
        pageTitle: document.title
      };
      
      return result;
    });
    
    console.log('Debug info:', {
      hasJsonLd: productData.hasJsonLd,
      hasProductGroup: productData.hasProductGroup,
      scriptCount: productData.scriptCount,
      pageTitle: productData.pageTitle,
      brand: productData.pageData.brand,
      name: productData.pageData.name,
      priceText: productData.pageData.price,
      extractedPrice: productData.pageData.extractedPrice
    });
    
    // Process the extracted data
    const jsonLd = productData.jsonLd;
    const productGroup = productData.productGroup;
    const pageData = productData.pageData;
    
    // Clean price function
    const cleanPrice = (priceStr) => {
      if (!priceStr) return null;
      const match = priceStr.match(/[\d,]+(?:\.\d{2})?/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
      return null;
    };
    
    // Determine currency from price string
    const getCurrency = (priceStr) => {
      if (!priceStr) return 'USD';
      if (priceStr.includes('$')) return 'USD';
      if (priceStr.includes('£')) return 'GBP';
      if (priceStr.includes('€')) return 'EUR';
      if (priceStr.includes('¥')) return 'JPY';
      return 'USD';
    };
    
    // Build final result - prioritize ProductGroup data for Farfetch
    const result = {
      url,
      name: pageData.name || productGroup?.name || jsonLd?.name || 'Unknown Product',
      brand: pageData.brand || productGroup?.brand?.name || productGroup?.brand || jsonLd?.brand?.name || jsonLd?.brand || 'Unknown Brand',
      price: cleanPrice(pageData.price) || pageData.extractedPrice || jsonLd?.offers?.price || 0,
      originalPrice: cleanPrice(pageData.originalPrice),
      currency: getCurrency(pageData.price) || pageData.extractedCurrency || jsonLd?.offers?.priceCurrency || 'USD',
      description: pageData.description || productGroup?.description || jsonLd?.description || '',
      images: pageData.images?.length > 0 ? pageData.images : [],
      sizes: pageData.sizes || [],
      color: pageData.color || productGroup?.color || jsonLd?.color || '',
      productId: pageData.productId || productGroup?.sku || jsonLd?.sku || '',
      materials: pageData.materials ? [pageData.materials] : [],
      inStock: pageData.sizes?.length > 0 || jsonLd?.offers?.availability?.includes('InStock'),
      source: 'farfetch',
      scrapedAt: new Date().toISOString()
    };
    
    // Clean up brand from name if it's included
    if (result.brand && result.name.startsWith(result.brand)) {
      result.name = result.name.replace(result.brand, '').trim();
    }
    
    // Extract color from name if not found
    if (!result.color && result.name) {
      const colorMatch = result.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive|orange|burgundy|maroon|gold|silver)\b/i);
      if (colorMatch) {
        result.color = colorMatch[0].toLowerCase();
      }
    }
    
    // Extract materials if found
    if (result.materials[0]) {
      const materialMatches = result.materials[0].match(/(\d+%\s+\w+(?:\s+\w+)?)/g);
      if (materialMatches) {
        result.materials = materialMatches;
      } else {
        result.materials = [];
      }
    }
    
    console.log('✅ Successfully scraped Farfetch product:', result.name);
    console.log('Brand:', result.brand);
    console.log('Price:', result.currency, result.price);
    console.log('Images found:', result.images.length);
    console.log('Sizes available:', result.sizes.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error scraping Farfetch with Puppeteer:', error.message);
    console.error('Stack:', error.stack);
    return {
      url,
      error: error.message,
      source: 'farfetch'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeFarfetchWithPuppeteer };