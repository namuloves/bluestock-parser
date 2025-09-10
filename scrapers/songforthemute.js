const puppeteer = require('puppeteer');

const scrapeSongForTheMute = async (url) => {
  console.log('🎵 Starting Song for the Mute scraper for:', url);
  
  let browser;
  try {
    // Initialize product object
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Song for the Mute',
      sizes: [],
      colors: [],
      material: '',
      inStock: true,
      currency: 'USD',
      retailer: 'Song for the Mute',
      sku: '',
      category: ''
    };

    // Launch Puppeteer
    const puppeteerOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };
    
    // Use system Chrome if available (for Docker/Railway)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    console.log('📱 Navigating to URL...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for the product content to load
    console.log('⏳ Waiting for content to load...');
    await page.waitForSelector('.product__view, .product__info, h1', { timeout: 10000 });
    
    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Extracting product data...');
    
    // Extract product data using page.evaluate
    const productData = await page.evaluate(() => {
      const data = {
        name: '',
        price: '',
        originalPrice: '',
        description: '',
        images: [],
        sizes: [],
        colors: [],
        material: '',
        sku: '',
        category: ''
      };
      
      // Product name - look for h1 in product info area
      const nameElement = document.querySelector('.product__info h1, h1.product__title, [class*="product-title"]');
      if (nameElement) {
        data.name = nameElement.textContent.trim();
        // Remove price from name if it's included
        data.name = data.name.replace(/\$[\d,]+(?:\.\d{2})?\s*\w+$/, '').trim();
      }
      
      // Price - look for price in product info
      const priceElement = document.querySelector('.product__info .product__price, .product__price, [class*="price"]:not([class*="original"])');
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        // Extract price with currency symbol
        const priceMatch = priceText.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
        if (priceMatch) {
          data.price = priceMatch[0];
        }
      }
      
      // If price not found, check in the h1 element
      if (!data.price && data.name) {
        const priceInName = data.name.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
        if (priceInName) {
          data.price = priceInName[0];
          // Clean the name
          data.name = data.name.replace(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?\s*\w+/, '').trim();
        }
      }
      
      // Original price (if on sale)
      const originalPriceElement = document.querySelector('.product__price--original, [class*="original-price"], .product__price s');
      if (originalPriceElement) {
        const originalText = originalPriceElement.textContent.trim();
        const originalMatch = originalText.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
        if (originalMatch) {
          data.originalPrice = originalMatch[0];
        }
      }
      
      // Description
      const descElements = document.querySelectorAll('.product__description, .product__info p, [class*="description"] p');
      const descriptions = [];
      descElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 20) {
          descriptions.push(text);
        }
      });
      data.description = descriptions.join(' ').trim();
      
      // Images
      const imageElements = document.querySelectorAll('.product__view img, .product__gallery img, [class*="gallery"] img');
      const imageSet = new Set();
      imageElements.forEach(img => {
        let src = img.src || img.dataset.src || img.dataset.lazySrc;
        
        // Check srcset for higher quality
        if (img.srcset || img.dataset.srcset) {
          const srcset = img.srcset || img.dataset.srcset;
          const sources = srcset.split(',');
          const lastSource = sources[sources.length - 1].trim().split(' ')[0];
          if (lastSource) {
            src = lastSource;
          }
        }
        
        if (src && src.startsWith('http') && !src.includes('placeholder')) {
          // Clean up Shopify CDN URLs
          if (src.includes('cdn.shopify.com')) {
            // Remove size parameters to get original image
            src = src.replace(/_\d+x\d+/, '').replace(/_crop_center/, '');
          }
          imageSet.add(src);
        }
      });
      data.images = Array.from(imageSet);
      
      // Sizes
      const sizeElements = document.querySelectorAll('.product__size option, .size-selector button, [class*="size"] option, [class*="size"] button');
      const sizeSet = new Set();
      sizeElements.forEach(el => {
        const size = el.textContent.trim();
        const isDisabled = el.disabled || el.classList.contains('disabled') || el.classList.contains('sold-out');
        if (size && !size.toLowerCase().includes('select') && !isDisabled) {
          sizeSet.add(size);
        }
      });
      data.sizes = Array.from(sizeSet);
      
      // Colors
      const colorElements = document.querySelectorAll('.product__color option, .color-selector button, [class*="color"] option, [class*="color"] button');
      const colorSet = new Set();
      colorElements.forEach(el => {
        const color = el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('title');
        if (color && !color.toLowerCase().includes('select')) {
          colorSet.add(color);
        }
      });
      data.colors = Array.from(colorSet);
      
      // Material - look in description or specific material sections
      const materialElements = document.querySelectorAll('[class*="material"], [class*="composition"], [class*="fabric"]');
      materialElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.includes('%')) {
          data.material = text;
        }
      });
      
      // If no material found, check description for percentages
      if (!data.material && data.description) {
        const materialMatch = data.description.match(/\d+%\s+\w+(?:\s*,\s*\d+%\s+\w+)*/);
        if (materialMatch) {
          data.material = materialMatch[0];
        }
      }
      
      // SKU
      const skuElement = document.querySelector('[class*="sku"], [class*="product-code"], [class*="style"]');
      if (skuElement) {
        const skuText = skuElement.textContent.trim();
        const skuMatch = skuText.match(/(?:SKU|Style|Code)[:\s]*([A-Z0-9-]+)/i);
        if (skuMatch) {
          data.sku = skuMatch[1];
        } else if (skuText.length < 50) {
          data.sku = skuText;
        }
      }
      
      // Category from breadcrumbs
      const breadcrumbs = document.querySelectorAll('.breadcrumb a, nav a, [class*="breadcrumb"] a');
      if (breadcrumbs.length > 1) {
        const categories = [];
        breadcrumbs.forEach(crumb => {
          const text = crumb.textContent.trim();
          if (text && !text.toLowerCase().includes('home')) {
            categories.push(text);
          }
        });
        if (categories.length > 0) {
          data.category = categories[categories.length - 1];
        }
      }
      
      return data;
    });
    
    // Merge extracted data with product object
    Object.assign(product, productData);
    
    // Extract currency from price
    if (product.price) {
      const currencyMatch = product.price.match(/[\$£€¥]/);
      if (currencyMatch) {
        switch(currencyMatch[0]) {
          case '£': product.currency = 'GBP'; break;
          case '€': product.currency = 'EUR'; break;
          case '¥': product.currency = 'JPY'; break;
          default: product.currency = 'USD';
        }
      }
    }
    
    // Check stock status
    const pageContent = await page.content();
    if (pageContent.toLowerCase().includes('sold out') || 
        pageContent.toLowerCase().includes('out of stock')) {
      product.inStock = false;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      const value = product[key];
      if (value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Song for the Mute product:', product.name || 'Unknown');
    
    await browser.close();
    return product;
    
  } catch (error) {
    console.error('❌ Song for the Mute scraping error:', error.message);
    
    if (browser) {
      await browser.close();
    }
    
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Check if URL is from Song for the Mute
const isSongForTheMute = (url) => {
  return url.includes('songforthemute.com');
};

module.exports = { scrapeSongForTheMute, isSongForTheMute };