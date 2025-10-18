const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testFarfetchDetailed() {
  const url = 'https://www.farfetch.com/shopping/women/ganni-floral-print-graphic-t-shirt-item-31313693.aspx?storeid=9783';
  let browser;
  
  try {
    console.log('🔍 Launching Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    console.log('📄 Navigating to:', url);
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Response status:', response.status());
    
    // Wait for content
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract detailed product data
    const productData = await page.evaluate(() => {
      const result = {
        brand: null,
        name: null,
        price: null,
        currency: null,
        originalPrice: null,
        description: null,
        images: [],
        sizes: [],
        color: null,
        materials: null,
        productId: null
      };
      
      // Get H1 content and parse it
      const h1 = document.querySelector('h1');
      if (h1) {
        const h1Text = h1.textContent.trim();
        const brandLink = h1.querySelector('a');
        if (brandLink) {
          result.brand = brandLink.textContent.trim();
          // Name is everything after the brand
          result.name = h1Text.replace(result.brand, '').trim();
        } else {
          result.name = h1Text;
        }
      }
      
      // Get JSON-LD data
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          
          // Check for ProductGroup (common on Farfetch)
          if (data['@type'] === 'ProductGroup') {
            if (!result.name) result.name = data.name;
            if (data.image && Array.isArray(data.image)) {
              result.images = data.image.map(img => img.contentUrl || img);
            }
            if (data.brand) {
              result.brand = data.brand.name || data.brand;
            }
            if (data.hasVariant && Array.isArray(data.hasVariant)) {
              // Extract sizes and prices from variants
              data.hasVariant.forEach(variant => {
                if (variant.size) {
                  result.sizes.push(variant.size);
                }
                if (variant.offers && variant.offers.price && !result.price) {
                  result.price = parseFloat(variant.offers.price);
                  result.currency = variant.offers.priceCurrency || 'USD';
                }
              });
            }
          }
          
          // Check for Product type
          if (data['@type'] === 'Product') {
            if (!result.name) result.name = data.name;
            if (!result.brand && data.brand) {
              result.brand = data.brand.name || data.brand;
            }
            if (data.offers) {
              const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              if (!result.price && offers.price) {
                result.price = parseFloat(offers.price);
                result.currency = offers.priceCurrency || 'USD';
              }
            }
            if (!result.description) result.description = data.description;
            if (data.image && !result.images.length) {
              if (typeof data.image === 'string') {
                result.images = [data.image];
              } else if (Array.isArray(data.image)) {
                result.images = data.image;
              }
            }
          }
        } catch (e) {
          console.log('Error parsing JSON-LD:', e.message);
        }
      }
      
      // Fallback to find price in the page
      if (!result.price) {
        // Look for price patterns in all text
        const pricePatterns = document.querySelectorAll('span, div');
        for (const el of pricePatterns) {
          const text = el.textContent.trim();
          if (text.match(/^[$£€]\s*[\d,]+(?:\.\d{2})?$/)) {
            const priceMatch = text.match(/[\d,]+(?:\.\d{2})?/);
            if (priceMatch) {
              result.price = parseFloat(priceMatch[0].replace(/,/g, ''));
              if (text.includes('$')) result.currency = 'USD';
              else if (text.includes('£')) result.currency = 'GBP';
              else if (text.includes('€')) result.currency = 'EUR';
              break;
            }
          }
        }
      }
      
      // Get images from img tags if not found
      if (result.images.length === 0) {
        const imgs = document.querySelectorAll('img[src*="cdn-images.farfetch"]');
        result.images = Array.from(imgs)
          .map(img => img.src)
          .filter(src => src && !src.includes('data:image'));
      }
      
      // Extract product ID from URL
      const urlMatch = window.location.href.match(/item-(\d+)/);
      if (urlMatch) {
        result.productId = urlMatch[1];
      }
      
      return result;
    });
    
    console.log('\n✅ Extracted Product Data:');
    console.log(JSON.stringify(productData, null, 2));
    
    // Build final product object
    const product = {
      url,
      name: productData.name || 'Unknown Product',
      brand: productData.brand || 'Unknown Brand',
      price: productData.price || 0,
      originalPrice: productData.originalPrice,
      currency: productData.currency || 'USD',
      description: productData.description || '',
      images: productData.images || [],
      sizes: productData.sizes || [],
      color: productData.color || '',
      productId: productData.productId || '',
      materials: productData.materials ? [productData.materials] : [],
      inStock: productData.sizes.length > 0,
      source: 'farfetch',
      scrapedAt: new Date().toISOString()
    };
    
    console.log('\n📦 Final Product:');
    console.log(JSON.stringify(product, null, 2));
    
    return product;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFarfetchDetailed();