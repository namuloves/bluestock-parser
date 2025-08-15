const puppeteer = require('puppeteer');

const scrapeZaraPuppeteer = async (url) => {
  console.log('🛍️ Starting Zara Puppeteer scraper for:', url);
  
  let browser;
  try {
    // Extract product ID from URL
    const productIdMatch = url.match(/p(\d+)\.html/);
    const productId = productIdMatch ? productIdMatch[1] : null;
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('📄 Navigating to Zara page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for product content
    await page.waitForTimeout(3000);
    
    // Extract product data
    const productData = await page.evaluate(() => {
      const product = {
        name: '',
        price: '',
        originalPrice: '',
        description: '',
        images: [],
        brand: 'Zara',
        sizes: [],
        colors: [],
        materials: [],
        inStock: true
      };
      
      // Try to get product name
      const nameElement = document.querySelector('h1.product-detail-info__header-name, h1[class*="product-name"], h1');
      if (nameElement) {
        product.name = nameElement.textContent.trim();
      }
      
      // Try to get price
      const priceElement = document.querySelector('.product-detail-info__price, .price__amount-current, [class*="price"]:not([class*="old"])');
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = '$' + priceMatch[0];
        }
      }
      
      // Try to get original price (if on sale)
      const originalPriceElement = document.querySelector('.price__amount--old, [class*="price"][class*="old"], s.price');
      if (originalPriceElement) {
        const priceText = originalPriceElement.textContent.trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.originalPrice = '$' + priceMatch[0];
        }
      }
      
      // Get images
      const imageElements = document.querySelectorAll('.media-image__image img, .product-detail-images__image img, [class*="media"] img');
      imageElements.forEach(img => {
        let src = img.src || img.dataset.src;
        if (src && !src.includes('placeholder') && !src.includes('transparent')) {
          // Convert to high-res
          src = src.replace(/w=\d+/, 'w=1920').replace(/h=\d+/, 'h=2880');
          if (!product.images.includes(src)) {
            product.images.push(src);
          }
        }
      });
      
      // Get sizes
      const sizeButtons = document.querySelectorAll('.size-selector__size-list button, .product-size-selector__size, [class*="size-selector"] button');
      sizeButtons.forEach(btn => {
        const size = btn.textContent.trim();
        if (size && !btn.disabled && !product.sizes.includes(size)) {
          product.sizes.push(size);
        }
      });
      
      // Get colors
      const colorElements = document.querySelectorAll('.product-detail-color-selector__color, [class*="color-selector"] [aria-label]');
      colorElements.forEach(el => {
        const color = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim();
        if (color && !product.colors.includes(color)) {
          product.colors.push(color);
        }
      });
      
      // Get description
      const descElement = document.querySelector('.expandable-text__inner, .product-detail-info__description, [class*="description"]');
      if (descElement) {
        product.description = descElement.textContent.trim();
      }
      
      // Check if out of stock
      const outOfStock = document.querySelector('.product-detail-info__out-of-stock, [class*="out-of-stock"]');
      if (outOfStock) {
        product.inStock = false;
      }
      
      // Try to extract from window.__PRELOADED_STATE__ if available
      if (window.__PRELOADED_STATE__) {
        try {
          const state = window.__PRELOADED_STATE__;
          if (state.product) {
            product.name = product.name || state.product.name;
            product.price = product.price || (state.product.price ? `$${state.product.price / 100}` : '');
            if (state.product.colors) {
              state.product.colors.forEach(c => {
                if (c.name && !product.colors.includes(c.name)) {
                  product.colors.push(c.name);
                }
              });
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      return product;
    });
    
    // Add product ID
    productData.productId = productId;
    productData.url = url;
    
    // Clean up empty fields
    Object.keys(productData).forEach(key => {
      if (productData[key] === '' || (Array.isArray(productData[key]) && productData[key].length === 0)) {
        delete productData[key];
      }
    });
    
    console.log('✅ Successfully scraped Zara product:', productData.name || 'Unknown');
    console.log('   Price:', productData.price || 'N/A');
    console.log('   Images:', productData.images?.length || 0);
    
    return productData;
    
  } catch (error) {
    console.error('❌ Zara Puppeteer scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Zara'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { scrapeZaraPuppeteer };