const axios = require('axios');
const cheerio = require('cheerio');

const scrapeReformation = async (url) => {
  console.log('🌱 Starting Reformation scraper for:', url);
  
  try {
    // Check if it's a Shopify store
    const isShopify = url.includes('/products/');
    if (isShopify) {
      // Try Shopify JSON endpoint
      try {
        const jsonUrl = url.includes('?') ? url.split('?')[0] + '.json' : url + '.json';
        const jsonResponse = await axios.get(jsonUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        
        if (jsonResponse.data && jsonResponse.data.product) {
          const prod = jsonResponse.data.product;
          const product = {
            url,
            name: prod.title,
            brand: prod.vendor || 'Reformation',
            price: prod.variants?.[0]?.price ? `$${(prod.variants[0].price / 100).toFixed(2)}` : '',
            description: prod.body_html?.replace(/<[^>]*>/g, '').trim() || '',
            images: prod.images?.map(img => img.src) || [],
            sizes: prod.variants?.map(v => v.title).filter(t => t !== 'Default Title') || [],
            inStock: prod.variants?.[0]?.available || false
          };
          
          console.log('✅ Successfully scraped Reformation product (Shopify):', product.name);
          return product;
        }
      } catch (e) {
        console.log('⚠️ Shopify JSON failed, trying HTML scraping');
      }
    }
    
    // Standard HTML scraping
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    const response = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(response.data);
    
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Reformation',
      sizes: [],
      colors: [],
      inStock: true,
      sustainability: '' // Reformation focuses on sustainability
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
    
    // HTML fallbacks - Reformation specific selectors
    if (!product.name) {
      product.name = $('h1.product__title').text().trim() ||
                     $('h1[data-product-title]').text().trim() ||
                     $('.product-single__title').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.product__price--sale').text().trim() ||
                        $('.product__price').text().trim() ||
                        $('[data-product-price]').text().trim() ||
                        $('.price').first().text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('.product__price--compare').text().trim() ||
                              $('[data-compare-price]').text().trim() ||
                              $('s.price').text().trim();
    
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = `$${originalMatch[0]}`;
      }
    }
    
    if (!product.description) {
      product.description = $('.product__description').text().trim() ||
                            $('[data-product-description]').text().trim() ||
                            $('.product-single__description').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Sustainability info (Reformation specific)
    const sustainabilityText = $('.sustainability-info').text().trim() ||
                                $('.product__sustainability').text().trim() ||
                                $('[data-sustainability]').text().trim();
    if (sustainabilityText) {
      product.sustainability = sustainabilityText;
    }
    
    // Images - Reformation specific
    if (product.images.length === 0) {
      $('.product__media img, .product-single__photo img, [data-product-image]').each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                       $(img).attr('data-src') || 
                       $(img).attr('data-srcset')?.split(',')[0]?.split(' ')[0];
        
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/_\d+x\./, '_2048x.') // Get 2048px version
                             .replace(/\?.*$/, '') // Remove query params
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
    $('.size-selector input[type="radio"], [data-option-name="Size"] option, .product-form__input--size label').each((i, sizeEl) => {
      const size = $(sizeEl).val() || $(sizeEl).text().trim() || $(sizeEl).attr('data-value');
      const isAvailable = !$(sizeEl).attr('disabled') &&
                          !$(sizeEl).hasClass('soldout');
      
      if (size && size !== 'Size' && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('.color-selector input[type="radio"], [data-option-name="Color"] option, .product-form__input--color label').each((i, colorEl) => {
      const colorName = $(colorEl).val() || 
                        $(colorEl).text().trim() || 
                        $(colorEl).attr('data-value');
      
      if (colorName && colorName !== 'Color' && !product.colors.includes(colorName)) {
        product.colors.push(colorName);
      }
    });
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Reformation product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Reformation scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Reformation'
    };
  }
};

module.exports = { scrapeReformation };