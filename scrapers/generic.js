const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGeneric(url) {
  try {
    console.log('🌐 Attempting generic scrape for:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const hostname = new URL(url).hostname;
    
    // Extract product name - try multiple selectors
    let productName = 
      $('h1').first().text().trim() ||
      $('[itemprop="name"]').first().text().trim() ||
      $('.product-title').first().text().trim() ||
      $('.product-name').first().text().trim() ||
      $('#product-title').first().text().trim() ||
      $('[data-testid="product-name"]').first().text().trim() ||
      $('title').text().split('-')[0].trim() ||
      'Unknown Product';
    
    // Extract price - try multiple selectors
    let price = 0;
    const priceSelectors = [
      '[itemprop="price"]',
      '.price',
      '.product-price',
      '.current-price',
      '[data-testid="product-price"]',
      '.price-now',
      '.sale-price',
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]'
    ];
    
    for (const selector of priceSelectors) {
      let priceText = '';
      if (selector.startsWith('meta')) {
        priceText = $(selector).attr('content') || '';
      } else {
        priceText = $(selector).first().text();
      }
      
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(',', ''));
        if (price > 0) break;
      }
    }
    
    // Extract images - try multiple selectors
    const images = [];

    // Try WooCommerce gallery images first (most specific)
    const imageSelectors = [
      '.woocommerce-product-gallery__image img', // WooCommerce gallery
      '.woocommerce-product-gallery img',
      '.product-image img',
      '.product-photo img',
      '[itemprop="image"]',
      '.gallery-image img',
      '.product-gallery img',
      '[data-testid="product-image"]',
      '.main-image img',
      '#product-image img',
      '.wp-post-image' // WordPress featured image
    ];

    for (const selector of imageSelectors) {
      $(selector).each((i, elem) => {
        let src = $(elem).attr('src') ||
                  $(elem).attr('data-src') ||
                  $(elem).attr('data-large_image') ||
                  $(elem).attr('data-lazy-src');

        if (src && !images.includes(src)) {
          // Make URL absolute if needed
          const imageUrl = src.startsWith('http') ? src : new URL(src, url).href;
          // Skip logo images, icons, and very small images
          if (!imageUrl.includes('logo') &&
              !imageUrl.includes('icon') &&
              !imageUrl.match(/\d+x\d+/) ||
              imageUrl.match(/\d{3,4}x\d{3,4}/)) {
            images.push(imageUrl);
          }
        }
      });
    }

    // If we found product gallery images, don't add og:image (likely a logo)
    // Only use og:image as fallback if no other images found
    if (images.length === 0) {
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) images.push(ogImage);
    }
    
    // Extract description
    let description = 
      $('[itemprop="description"]').text().trim() ||
      $('.product-description').text().trim() ||
      $('.product-details').text().trim() ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';
    
    // Limit description length
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }
    
    // Extract brand - try to detect from various sources
    let brand = 
      $('[itemprop="brand"]').text().trim() ||
      $('.brand-name').text().trim() ||
      $('.product-brand').text().trim() ||
      $('meta[property="product:brand"]').attr('content') ||
      '';
    
    // If no brand found, try to extract from domain
    if (!brand) {
      const domainParts = hostname.split('.');
      brand = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
      brand = brand.replace(/-/g, ' ');
    }
    
    // Extract color - common selectors
    let color = 
      $('.color-name').text().trim() ||
      $('.selected-color').text().trim() ||
      $('[data-testid="product-color"]').text().trim() ||
      '';
    
    // Extract sizes if available
    const sizes = [];
    $('.size-option, .size-selector option, [data-testid="size-option"]').each((i, elem) => {
      const size = $(elem).text().trim();
      if (size && !sizes.includes(size)) {
        sizes.push(size);
      }
    });
    
    // Check if on sale
    const isOnSale = $('.sale-badge').length > 0 || 
                     $('.discount-badge').length > 0 ||
                     $('.was-price').length > 0 ||
                     $('.original-price').length > 0;
    
    // Try to get original price if on sale
    let originalPrice = price;
    if (isOnSale) {
      const originalPriceText = 
        $('.was-price').text() ||
        $('.original-price').text() ||
        $('.compare-at-price').text();
      
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        originalPrice = parseFloat(originalMatch[0].replace(',', ''));
      }
    }
    
    console.log('✅ Generic scraper extracted:', {
      name: productName,
      price,
      images: images.length,
      hasDescription: !!description
    });
    
    return {
      success: true,
      product: {
        product_name: productName,
        brand: brand,
        original_price: originalPrice,
        sale_price: price,
        is_on_sale: isOnSale,
        discount_percentage: isOnSale && originalPrice > price ? 
          Math.round((1 - price / originalPrice) * 100) : null,
        sale_badge: isOnSale ? 'SALE' : null,
        image_urls: images.slice(0, 10), // Limit to 10 images
        vendor_url: url,
        description: description,
        color: color,
        category: 'Fashion', // Default category
        material: '',
        sizes: sizes,
        currency: 'USD',
        availability: 'in_stock',
        platform: 'generic',
        
        // Legacy fields for compatibility
        name: productName,
        price: price,
        images: images.slice(0, 10),
        originalPrice: originalPrice,
        isOnSale: isOnSale,
        discountPercentage: isOnSale && originalPrice > price ? 
          Math.round((1 - price / originalPrice) * 100) : null,
        saleBadge: isOnSale ? 'SALE' : null
      }
    };
    
  } catch (error) {
    console.error('❌ Generic scraper error:', error.message);
    
    // Return minimal data even on error
    return {
      success: false,
      product: {
        product_name: 'Product from ' + new URL(url).hostname,
        brand: new URL(url).hostname.split('.')[0],
        original_price: 0,
        sale_price: 0,
        is_on_sale: false,
        discount_percentage: null,
        sale_badge: null,
        image_urls: [],
        vendor_url: url,
        description: 'Unable to extract product details. Please enter manually.',
        color: '',
        category: 'Fashion',
        material: '',
        currency: 'USD',
        availability: 'unknown',
        platform: 'generic',
        
        // Legacy fields
        name: 'Product from ' + new URL(url).hostname,
        price: 0,
        images: [],
        originalPrice: 0,
        isOnSale: false,
        discountPercentage: null,
        saleBadge: null
      }
    };
  }
}

module.exports = { scrapeGeneric };