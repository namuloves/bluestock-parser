const puppeteer = require('puppeteer');

async function scrapeStoriesWithPuppeteer(url) {
  let browser;
  
  try {
    console.log('🎭 Using Puppeteer for Stories.com...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set additional headers to avoid detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for content to load
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
    
    // Extract product data
    const productData = await page.evaluate(() => {
      // Try to get product name
      const name = document.querySelector('h1')?.textContent?.trim() || 
                   document.querySelector('.product-name')?.textContent?.trim() ||
                   document.querySelector('[data-testid="product-name"]')?.textContent?.trim() ||
                   '';
      
      // Try to get price
      const priceElement = document.querySelector('.price') ||
                          document.querySelector('[data-testid="price"]') ||
                          document.querySelector('.product-price');
      
      let price = '';
      let originalPrice = '';
      
      if (priceElement) {
        const priceText = priceElement.textContent || '';
        // Look for sale prices
        const salePriceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
        if (salePriceMatch) {
          price = salePriceMatch[1];
        }
        
        // Look for original price
        const originalPriceElement = document.querySelector('.original-price') ||
                                     document.querySelector('.was-price') ||
                                     document.querySelector('[data-testid="original-price"]');
        if (originalPriceElement) {
          const originalMatch = originalPriceElement.textContent?.match(/\$?([\d,]+\.?\d*)/);
          if (originalMatch) {
            originalPrice = originalMatch[1];
          }
        }
      }
      
      // Get images
      const images = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && (src.includes('product') || src.includes('media.stories'))) {
          if (!images.includes(src)) {
            images.push(src);
          }
        }
      });
      
      // Get sizes
      const sizes = [];
      document.querySelectorAll('.size-option, [data-testid*="size"], button[aria-label*="size"]').forEach(elem => {
        const size = elem.textContent?.trim();
        if (size && !sizes.includes(size)) {
          sizes.push(size);
        }
      });
      
      // Get color
      const color = document.querySelector('.color-name')?.textContent?.trim() ||
                   document.querySelector('[data-testid="color"]')?.textContent?.trim() ||
                   '';
      
      // Get description
      const description = document.querySelector('.product-description')?.textContent?.trim() ||
                         document.querySelector('[data-testid="description"]')?.textContent?.trim() ||
                         '';
      
      // Check if it's in stock
      const outOfStock = document.querySelector('.out-of-stock, .sold-out') !== null;
      
      return {
        name,
        price,
        originalPrice,
        images,
        sizes,
        color,
        description,
        inStock: !outOfStock
      };
    });
    
    // Parse the SKU from URL
    const skuMatch = url.match(/(\d+)(?:\/)?$/);
    const sku = skuMatch ? skuMatch[1] : '';
    
    // Format the response
    const priceNumeric = productData.price ? parseFloat(productData.price.replace(',', '')) : 0;
    const originalPriceNumeric = productData.originalPrice ? parseFloat(productData.originalPrice.replace(',', '')) : priceNumeric;
    
    return {
      name: productData.name || 'Stories Product',
      price: priceNumeric ? `$${priceNumeric}` : 'Price not available',
      originalPrice: originalPriceNumeric > priceNumeric ? `$${originalPriceNumeric}` : null,
      images: productData.images.slice(0, 10), // Limit to 10 images
      description: productData.description,
      sizes: productData.sizes,
      color: productData.color,
      sku: sku,
      brand: '& Other Stories',
      category: 'Clothing',
      isOnSale: originalPriceNumeric > priceNumeric,
      inStock: productData.inStock,
      url: url
    };
    
  } catch (error) {
    console.error('Stories Puppeteer error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeStoriesWithPuppeteer };