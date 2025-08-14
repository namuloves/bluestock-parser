const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeEtsy = async (url) => {
  console.log('🛍️ Starting Etsy scraper for:', url);
  
  try {
    // Extract listing ID from URL
    const listingIdMatch = url.match(/listing\/(\d+)/);
    const listingId = listingIdMatch ? listingIdMatch[1] : null;
    
    // Add headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // Get axios config with proxy if needed
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Etsy page with proxy support...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Extract product data
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      colors: [],
      material: '',
      inStock: true,
      rating: '',
      reviewCount: '',
      shipping: '',
      details: []
    };
    
    // Extract product name
    product.name = $('h1[data-buy-box-listing-title]').text().trim() ||
                   $('h1.wt-text-body-01').text().trim() ||
                   $('h1').first().text().trim();
    
    // Extract price - try multiple methods
    // Method 1: From meta tag
    const metaPrice = $('meta[property="product:price:amount"]').attr('content');
    if (metaPrice) {
      product.price = '$' + metaPrice;
    }
    
    // Method 2: From structured data
    if (!product.price) {
      const scripts = $('script[type="application/ld+json"]');
      scripts.each((i, script) => {
        try {
          const data = JSON.parse($(script).html());
          if (data.offers && data.offers.price) {
            product.price = '$' + data.offers.price;
          } else if (data['@graph']) {
            data['@graph'].forEach(item => {
              if (item.offers && item.offers.price) {
                product.price = '$' + item.offers.price;
              }
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
    }
    
    // Method 3: From visible price text (fallback)
    if (!product.price) {
      const priceText = $('p[data-buy-box-region="price"] .wt-text-title-largest').text().trim() ||
                        $('.wt-text-title-03.wt-mr-xs-1').text().trim();
      
      if (priceText) {
        // Check for price range
        if (priceText.includes('-')) {
          const prices = priceText.match(/\$[\d,]+\.?\d*/g);
          if (prices && prices.length > 0) {
            product.price = prices[0];
          }
        } else {
          const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
          if (priceMatch) {
            product.price = priceMatch[0];
          }
        }
      }
    }
    
    // Check for sale price
    const saleBadge = $('.wt-badge--sale').text().trim();
    if (saleBadge) {
      const originalPriceText = $('p[data-buy-box-region="price"] .wt-text-strikethrough').text().trim();
      const originalMatch = originalPriceText.match(/\$[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = originalMatch[0];
      }
    }
    
    // Extract shop/brand name - fixed selector
    const shopLink = $('a[data-shop-name]');
    if (shopLink.length) {
      // Try data attribute first
      product.brand = shopLink.attr('data-shop-name') || shopLink.text().trim();
    }
    
    // Fallback methods for shop name
    if (!product.brand || product.brand.includes('stars')) {
      // Look for shop name in other locations
      product.brand = $('p.wt-text-caption a[href*="/shop/"]').text().trim() ||
                      $('span[itemprop="brand"]').text().trim() ||
                      $('a.wt-text-link-no-underline[href*="/shop/"] span').text().trim();
      
      // Filter out rating text
      if (product.brand && product.brand.includes('out of 5 stars')) {
        product.brand = '';
      }
    }
    
    // Final fallback to "Etsy Shop" if no brand found
    if (!product.brand) {
      product.brand = 'Etsy Shop';
    }
    
    // Extract images
    const imageElements = $('ul[data-carousel-nav-list] img, .image-carousel-container img');
    imageElements.each((i, el) => {
      let imageUrl = $(el).attr('src') || $(el).attr('data-src');
      if (imageUrl) {
        // Convert thumbnail to full-size image
        imageUrl = imageUrl.replace(/il_\d+x\d+/, 'il_fullxfull')
                           .replace(/il_\d+xN/, 'il_fullxfull');
        if (!product.images.includes(imageUrl)) {
          product.images.push(imageUrl);
        }
      }
    });
    
    // If no carousel images, try main image
    if (product.images.length === 0) {
      const mainImage = $('img[data-listing-card-listing-image]').attr('src') ||
                        $('img.wt-max-width-full').first().attr('src');
      if (mainImage) {
        const fullImage = mainImage.replace(/il_\d+x\d+/, 'il_fullxfull')
                                   .replace(/il_\d+xN/, 'il_fullxfull');
        product.images.push(fullImage);
      }
    }
    
    // Extract variations (size, color, etc.)
    const variationSelects = $('select[data-buy-box-region="Variations"]');
    variationSelects.each((i, select) => {
      const label = $(select).attr('aria-label') || '';
      const options = [];
      
      $(select).find('option').each((j, option) => {
        const value = $(option).text().trim();
        if (value && value !== 'Select an option' && value !== 'Select a size') {
          options.push(value);
        }
      });
      
      if (label.toLowerCase().includes('size')) {
        product.sizes = options;
      } else if (label.toLowerCase().includes('color') || label.toLowerCase().includes('colour')) {
        product.colors = options;
      }
    });
    
    // Alternative variation extraction
    if (product.sizes.length === 0 && product.colors.length === 0) {
      const variationButtons = $('.wt-btn-group__item button');
      variationButtons.each((i, btn) => {
        const text = $(btn).text().trim();
        if (text) {
          // Try to determine if it's a size or color
          if (/^(XS|S|M|L|XL|XXL|\d+)/.test(text)) {
            product.sizes.push(text);
          } else {
            product.colors.push(text);
          }
        }
      });
    }
    
    // Extract description
    const descriptionElement = $('div[data-product-details-description]');
    if (descriptionElement.length) {
      product.description = descriptionElement.text().trim();
    } else {
      // Fallback to other description areas
      product.description = $('div[data-buy-box-region="description"]').text().trim() ||
                            $('.wt-content-toggle__truncated-markup').text().trim() ||
                            $('.listing-page-description-text').text().trim();
    }
    
    // Extract material from description or details
    const materialMatch = product.description.match(/(?:made of|material[s]?:|composition:)\s*([^.\n]+)/i);
    if (materialMatch) {
      product.material = materialMatch[1].trim();
    }
    
    // Extract rating and review count
    const ratingText = $('span[data-reviews-rating]').text().trim() ||
                       $('.wt-display-inline-block .wt-text-caption').first().text().trim();
    if (ratingText) {
      const ratingMatch = ratingText.match(/([\d.]+)/);
      if (ratingMatch) {
        product.rating = ratingMatch[1];
      }
    }
    
    const reviewCountText = $('a[data-reviews-jump-link]').text().trim() ||
                            $('.wt-text-link-no-underline .wt-text-caption').text().trim();
    const reviewMatch = reviewCountText.match(/\(?([\d,]+)\)?/);
    if (reviewMatch) {
      product.reviewCount = reviewMatch[1].replace(/,/g, '');
    }
    
    // Extract shipping info
    const shippingElement = $('.wt-text-caption-title:contains("Shipping")').parent();
    if (shippingElement.length) {
      product.shipping = shippingElement.text().replace('Shipping', '').trim();
    } else {
      product.shipping = $('.shipping-time-wrapper').text().trim() ||
                         $('div[data-estimated-delivery]').text().trim();
    }
    
    // Extract additional details
    const detailsSection = $('div[data-product-details-section]');
    if (detailsSection.length) {
      detailsSection.find('li').each((i, li) => {
        const detail = $(li).text().trim();
        if (detail) {
          product.details.push(detail);
        }
      });
    }
    
    // Check stock status
    const soldOutIndicator = $('.wt-badge--sold-out').text().trim() ||
                             $('button:contains("Sold out")').text().trim();
    if (soldOutIndicator) {
      product.inStock = false;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Etsy product:', product.name);
    return product;
    
  } catch (error) {
    console.error('❌ Etsy scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeEtsy };