const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeAsos = async (url) => {
  console.log('🛍️ Starting ASOS scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.asos.com/'
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
    
    // Try to find ASOS's window.asos.pdp.config data
    let productData = null;
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      if (scriptContent.includes('window.asos.pdp.config')) {
        const configMatch = scriptContent.match(/window\.asos\.pdp\.config\s*=\s*({.*?});/s);
        if (configMatch) {
          try {
            productData = JSON.parse(configMatch[1]);
          } catch (e) {
            // Failed to parse
          }
        }
      }
    });
    
    // Extract from productData if available
    if (productData && productData.product) {
      const prod = productData.product;
      product.name = prod.name || '';
      product.brand = prod.brandName || '';
      product.price = prod.price?.current?.text || '';
      product.originalPrice = prod.price?.previous?.text || '';
      product.description = prod.description || '';
      
      if (prod.images) {
        prod.images.forEach(img => {
          if (img.url && !product.images.includes(img.url)) {
            product.images.push(img.url);
          }
        });
      }
      
      if (prod.variants) {
        prod.variants.forEach(variant => {
          if (variant.displaySizeText && !product.sizes.includes(variant.displaySizeText)) {
            product.sizes.push(variant.displaySizeText);
          }
        });
      }
    }
    
    // Try JSON-LD as fallback
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product') {
          if (!product.name) product.name = jsonData.name || '';
          if (!product.description) product.description = jsonData.description || '';
          
          if (!product.images.length && jsonData.image) {
            if (typeof jsonData.image === 'string') {
              product.images.push(jsonData.image);
            } else if (Array.isArray(jsonData.image)) {
              product.images = jsonData.image;
            }
          }
          
          if (jsonData.offers && !product.price) {
            const offer = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            if (offer.price) {
              product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
            }
            product.inStock = offer.availability?.includes('InStock') || false;
          }
          
          if (jsonData.brand && !product.brand) {
            product.brand = jsonData.brand.name || jsonData.brand;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // HTML fallbacks - ASOS specific selectors
    if (!product.name) {
      product.name = $('h1').first().text().trim() ||
                     $('.product-hero h1').text().trim() ||
                     $('[data-test-id="product-name"]').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.brand) {
      product.brand = $('.product-description a').first().text().trim() ||
                      $('[data-test-id="product-brand"]').text().trim() ||
                      $('.brand-description a').text().trim() || 'ASOS';
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.product-price__current').text().trim() ||
                        $('[data-test-id="current-price"]').text().trim() ||
                        $('.current-price').text().trim();
      
      if (priceText) {
        product.price = priceText.replace(/[^\d,.$£€]/g, '').trim();
      }
    }
    
    // Original price if on sale
    if (!product.originalPrice) {
      const originalPriceText = $('.product-price__previous').text().trim() ||
                                $('[data-test-id="previous-price"]').text().trim() ||
                                $('.previous-price').text().trim();
      
      if (originalPriceText) {
        product.originalPrice = originalPriceText.replace(/[^\d,.$£€]/g, '').trim();
      }
    }
    
    if (!product.description) {
      product.description = $('.product-description__content').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('[data-test-id="product-details"]').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - ASOS specific
    if (product.images.length === 0) {
      // ASOS uses a gallery with multiple images
      $('.gallery-image img, .product-carousel img, [data-test-id="gallery-image"]').each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                       $(img).attr('data-src') || 
                       $(img).attr('srcset')?.split(',')[0]?.split(' ')[0];
        
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/\$XXL\$/, '$XXL$') // Keep XXL size
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
    if (product.sizes.length === 0) {
      $('.size-section button, [data-test-id="size-select"] option, .size-selector button').each((i, sizeEl) => {
        const size = $(sizeEl).text().trim() || $(sizeEl).attr('data-size');
        const isAvailable = !$(sizeEl).hasClass('disabled') && 
                            !$(sizeEl).attr('disabled') &&
                            !$(sizeEl).hasClass('out-of-stock');
        
        if (size && size !== 'Please select' && !product.sizes.includes(size)) {
          product.sizes.push(size);
        }
      });
    }
    
    // Colors
    $('.colour-section button, [data-test-id="colour-select"] button, .color-selector button').each((i, colorEl) => {
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
    
    console.log('✅ Successfully scraped ASOS product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ ASOS scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'ASOS'
    };
  }
};

module.exports = { scrapeAsos };