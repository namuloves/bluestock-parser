const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeUrbanOutfitters = async (url) => {
  console.log('🏙️ Starting Urban Outfitters scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
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
      brand: 'Urban Outfitters',
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
    
    // HTML fallbacks
    if (!product.name) {
      product.name = $('h1.c-pwa-product-meta-heading').text().trim() ||
                     $('.c-product-meta__heading').text().trim() ||
                     $('h1[data-qa="product-name"]').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.c-pwa-product-price__current').text().trim() ||
                        $('.c-product-meta__current-price').text().trim() ||
                        $('[data-qa="product-price"]').text().trim() ||
                        $('.product-price').text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('.c-pwa-product-price__original').text().trim() ||
                              $('.c-product-meta__original-price').text().trim() ||
                              $('s.product-price').text().trim();
    
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = `$${originalMatch[0]}`;
      }
    }
    
    if (!product.description) {
      product.description = $('.c-product-description__body').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('[data-qa="product-details"]').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images
    if (product.images.length === 0) {
      // UO uses a carousel with multiple image sources
      $('.c-pwa-image-viewer__thumbs img, .product-images img, [data-qa="product-image"]').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/\?.*$/, '') // Remove query params
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
    $('.c-pwa-product-size__options button, .product-sizes button, [data-qa="size-selector"] button').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim();
      const isAvailable = !$(sizeEl).hasClass('is-disabled') && 
                          !$(sizeEl).attr('disabled') &&
                          !$(sizeEl).hasClass('out-of-stock');
      
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('.c-pwa-product-color__options button, .product-colors button, [data-qa="color-selector"] button').each((i, colorEl) => {
      const colorName = $(colorEl).attr('aria-label') || 
                        $(colorEl).attr('title') || 
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
    
    console.log('✅ Successfully scraped Urban Outfitters product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Urban Outfitters scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Urban Outfitters'
    };
  }
};

module.exports = { scrapeUrbanOutfitters };