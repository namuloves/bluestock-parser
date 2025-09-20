const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeFreePeople = async (url) => {
  console.log('🌻 Starting Free People scraper for:', url);

  // Try enhanced Puppeteer approach first
  try {
    const { scrapeFreePeopleEnhanced } = require('./freepeople-enhanced');
    console.log('🚀 Using enhanced Puppeteer for Free People...');
    const enhancedResult = await scrapeFreePeopleEnhanced(url);
    if (enhancedResult.success && enhancedResult.product) {
      console.log('✅ Returning enhanced Free People scraper results');
      return enhancedResult.product;
    }
  } catch (enhancedError) {
    console.log('⚠️ Enhanced Puppeteer failed:', enhancedError.message);
  }

  // Fall back to basic scraper
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5
    });
    
    const response = await axios.get(url, axiosConfig);
    
    const $ = cheerio.load(response.data);
    
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Free People',
      sizes: [],
      colors: [],
      inStock: true
    };
    
    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product') {
          product.name = jsonData.name || '';
          product.description = jsonData.description || '';
          
          if (jsonData.image) {
            if (typeof jsonData.image === 'string') {
              product.images.push(jsonData.image);
            } else if (Array.isArray(jsonData.image)) {
              product.images = jsonData.image;
            }
          }
          
          if (jsonData.offers) {
            const offer = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            if (offer.price) {
              product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
            }
            product.inStock = offer.availability?.includes('InStock') || false;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // HTML fallbacks - Free People specific selectors
    if (!product.name) {
      product.name = $('h1.c-product-meta__heading').text().trim() ||
                     $('h1[data-qa="product-name"]').text().trim() ||
                     $('.product-name h1').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.c-product-meta__current-price').text().trim() ||
                        $('.product-price .price-sales').text().trim() ||
                        $('[data-qa="product-price"]').text().trim() ||
                        $('.price-standard').text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('.c-product-meta__original-price').text().trim() ||
                              $('.price-standard').text().trim() ||
                              $('s.product-price').text().trim();
    
    if (originalPriceText && originalPriceText !== product.price) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = `$${originalMatch[0]}`;
      }
    }
    
    if (!product.description) {
      product.description = $('.c-product-description__body').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('[data-qa="product-details"]').text().trim() ||
                            $('.accordion-content').first().text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - Free People specific
    if (product.images.length === 0) {
      $('.c-product-image__thumb img, .product-thumbnails img, .product-image img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-zoom-image');
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/\?.*$/, '') // Remove query params
                             .replace(/w=\d+/, 'w=1200') // Higher resolution
                             .replace(/\/\//, 'https://'); // Ensure https
          
          if (!product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      });
      
      // Fallback to meta image
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
    }
    
    // Sizes
    $('.size-selector button, .product-size-options button, [data-qa="size-selector"] button').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim();
      const isAvailable = !$(sizeEl).hasClass('is-disabled') && 
                          !$(sizeEl).attr('disabled') &&
                          !$(sizeEl).hasClass('unselectable');
      
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('.color-selector button, .product-color-options button, [data-qa="color-selector"] button').each((i, colorEl) => {
      const colorName = $(colorEl).attr('aria-label') || 
                        $(colorEl).attr('title') || 
                        $(colorEl).attr('data-color') ||
                        $(colorEl).text().trim();
      
      if (colorName && !product.colors.includes(colorName)) {
        product.colors.push(colorName);
      }
    });
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Free People product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Free People scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Free People'
    };
  }
};

module.exports = { scrapeFreePeople };