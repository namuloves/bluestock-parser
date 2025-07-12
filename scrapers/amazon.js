const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

async function scrapeAmazonProduct(url) {
  let browser;
  
  try {
    console.log('🚀 Starting Amazon scraper for:', url);
    
    // Launch browser with stealth settings
    browser = await puppeteer.launch({
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
    });

    const page = await browser.newPage();
    
    // Set random user agent
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Block images and some resources to speed up
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image' || req.resourceType() === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('📄 Navigating to Amazon product page...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for product content to load
    await page.waitForSelector('#productTitle, [data-testid="product-title"]', { timeout: 10000 });

    console.log('📊 Extracting product data...');
    const productData = await page.evaluate(() => {
      // Helper function to clean text
      const cleanText = (text) => text?.trim().replace(/\\s+/g, ' ') || '';
      
      // Extract product name
      const titleSelectors = [
        '#productTitle',
        '[data-testid="product-title"]',
        '.product-title',
        'h1'
      ];
      
      let productName = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          productName = cleanText(element.textContent);
          break;
        }
      }

      // Extract brand
      const brandSelectors = [
        '#bylineInfo',
        '.a-link-normal[data-attribute="brand"]',
        '[data-testid="brand-name"]',
        '.po-brand .a-span9'
      ];
      
      let brand = '';
      for (const selector of brandSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          brand = cleanText(element.textContent).replace(/^Brand:\\s*/i, '');
          break;
        }
      }

      // Extract price information
      const priceSelectors = [
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        '.a-price-current .a-offscreen',
        '[data-testid="price"] .a-offscreen',
        '.a-price .a-offscreen'
      ];
      
      let price = '';
      let originalPrice = '';
      
      // Current/sale price
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          price = cleanText(element.textContent);
          break;
        }
      }

      // Original price (if on sale)
      const originalPriceSelectors = [
        '.a-price.a-text-price .a-offscreen',
        '[data-testid="list-price"] .a-offscreen',
        '.a-text-strike .a-offscreen'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent !== price) {
          originalPrice = cleanText(element.textContent);
          break;
        }
      }

      // Extract images
      const images = [];
      const imageSelectors = [
        '#landingImage',
        '[data-testid="product-image"]',
        '.a-dynamic-image',
        '#imgTagWrapperId img'
      ];
      
      imageSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(img => {
          const src = img.src || img.dataset.src;
          if (src && !images.includes(src)) {
            images.push(src);
          }
        });
      });

      // Extract description
      const descSelectors = [
        '#feature-bullets ul',
        '[data-testid="product-description"]',
        '#productDescription p'
      ];
      
      let description = '';
      for (const selector of descSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          description = cleanText(element.textContent);
          break;
        }
      }

      // Extract availability
      let availability = 'unknown';
      const availabilityElement = document.querySelector('#availability .a-color-success, #availability .a-color-state');
      if (availabilityElement) {
        const availText = cleanText(availabilityElement.textContent).toLowerCase();
        if (availText.includes('in stock')) {
          availability = 'in_stock';
        } else if (availText.includes('out of stock')) {
          availability = 'out_of_stock';
        }
      }

      return {
        product_name: productName,
        brand: brand,
        price: price,
        original_price: originalPrice || price,
        description: description,
        image_urls: images,
        availability: availability,
        currency: 'USD', // Amazon defaults to USD for US site
        is_on_sale: originalPrice && originalPrice !== price,
        sale_badge: originalPrice && originalPrice !== price ? 'Sale' : null
      };
    });

    console.log('✅ Amazon scraping completed successfully');
    return {
      success: true,
      product: {
        ...productData,
        // Ensure consistent naming with main app
        name: productData.product_name,
        images: productData.image_urls,
        originalPrice: productData.original_price,
        isOnSale: productData.is_on_sale,
        saleBadge: productData.sale_badge
      }
    };

  } catch (error) {
    console.error('❌ Amazon scraping failed:', error);
    return {
      success: false,
      error: `Amazon scraping failed: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeAmazonProduct };