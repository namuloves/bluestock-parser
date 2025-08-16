const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeRevolve = async (url) => {
  console.log('🌟 Starting Revolve scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.revolve.com/'
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
      brand: '',
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
          
          if (jsonData.brand) {
            product.brand = jsonData.brand.name || jsonData.brand;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // HTML fallbacks - Revolve specific selectors
    if (!product.name) {
      product.name = $('h1.product-titles__product-title').text().trim() ||
                     $('h1.u-margin-b--xs').text().trim() ||
                     $('.product-name').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.brand) {
      product.brand = $('.product-titles__brand').text().trim() ||
                      $('a.u-text-decoration--none').first().text().trim() ||
                      $('.brand-name').text().trim() || 'Revolve';
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.product-price__price--sale').text().trim() ||
                        $('.product-price__price').text().trim() ||
                        $('[data-at="price"]').text().trim() ||
                        $('.price').first().text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('.product-price__price--original').text().trim() ||
                              $('span.strikethrough').text().trim() ||
                              $('.original-price').text().trim();
    
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = `$${originalMatch[0]}`;
      }
    }
    
    if (!product.description) {
      product.description = $('.product-details__description').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('.u-margin-t--lg').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - Revolve specific
    if (product.images.length === 0) {
      // Revolve uses a carousel with multiple images
      $('.product-images__image img, .js-zoom-images img, .product-carousel img').each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                       $(img).attr('data-src') || 
                       $(img).attr('data-zoom');
        
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/\?.*$/, '') // Remove query params
                             .replace(/d\/images/, 'd/images') // Keep path structure
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
    $('.size-selector__size-option, .js-size-option, [data-at="size-option"]').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim() || $(sizeEl).attr('data-size');
      const isAvailable = !$(sizeEl).hasClass('is-oos') && 
                          !$(sizeEl).hasClass('disabled') &&
                          !$(sizeEl).attr('disabled');
      
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('.color-selector__option, .js-color-option, [data-at="color-option"]').each((i, colorEl) => {
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
    
    console.log('✅ Successfully scraped Revolve product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Revolve scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Revolve'
    };
  }
};

module.exports = { scrapeRevolve };