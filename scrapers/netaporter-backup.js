const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeNetAPorter = async (url) => {
  console.log('💎 Starting Net-a-Porter scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.net-a-porter.com/'
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
      inStock: true,
      designer: ''
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
    
    // HTML fallbacks - Net-a-Porter specific selectors
    if (!product.name) {
      product.name = $('h1.ProductDetails24__name').text().trim() ||
                     $('h1[data-testid="product-name"]').text().trim() ||
                     $('.product-name').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.brand) {
      product.brand = $('span.ProductDetails24__designer').text().trim() ||
                      $('[data-testid="product-designer"]').text().trim() ||
                      $('.designer-name').text().trim() || '';
      product.designer = product.brand; // Net-a-Porter focuses on designer brands
    }
    
    if (!product.price) {
      // Get current price
      const priceText = $('.PriceWithSchema9__value--sale').text().trim() ||
                        $('.PriceWithSchema9__value').text().trim() ||
                        $('[data-testid="product-price"]').text().trim() ||
                        $('.product-price').text().trim();
      
      if (priceText) {
        // Net-a-Porter includes currency symbol
        product.price = priceText.replace(/[^\d,.$£€¥]/g, '').trim();
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('.PriceWithSchema9__value--previous').text().trim() ||
                              $('[data-testid="product-price-original"]').text().trim() ||
                              $('.original-price').text().trim();
    
    if (originalPriceText) {
      product.originalPrice = originalPriceText.replace(/[^\d,.$£€¥]/g, '').trim();
    }
    
    if (!product.description) {
      product.description = $('.ProductDetails24__description').text().trim() ||
                            $('[data-testid="product-description"]').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('.AccordionPanel24__content').first().text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - Net-a-Porter specific
    if (product.images.length === 0) {
      // NAP uses high-quality product images
      $('.ImageCarousel24__image img, .Slideshow__image img, [data-testid="product-image"]').each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                       $(img).attr('data-src') || 
                       $(img).attr('data-image-url');
        
        if (imageUrl) {
          // Get high-res version
          imageUrl = imageUrl.replace(/\?.*$/, '') // Remove query params
                             .replace(/_\d+_/, '_xl_') // Get XL size
                             .replace(/\/\//, 'https://'); // Ensure https
          
          if (!product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      });
      
      // Try data attributes for images
      $('[data-image-zoom]').each((i, el) => {
        const zoomImage = $(el).attr('data-image-zoom');
        if (zoomImage && !product.images.includes(zoomImage)) {
          product.images.push(zoomImage);
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
    $('.SizeSelector24__size-button, [data-testid="size-option"], .size-option').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim() || $(sizeEl).attr('data-size');
      const isAvailable = !$(sizeEl).hasClass('is-disabled') && 
                          !$(sizeEl).attr('disabled') &&
                          !$(sizeEl).hasClass('out-of-stock');
      
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors - Net-a-Porter usually shows one color per product page
    const colorText = $('.ProductDetails24__color').text().trim() ||
                      $('[data-testid="product-color"]').text().trim() ||
                      $('.product-color').text().trim();
    
    if (colorText) {
      product.colors.push(colorText);
    }
    
    // Additional details specific to luxury items
    const materials = $('.AccordionPanel24__content:contains("Composition")').text().trim() ||
                      $('[data-testid="product-composition"]').text().trim();
    if (materials) {
      product.materials = materials;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Net-a-Porter product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Net-a-Porter scraping error:', error.message);
    return {
      url,
      error: error.message,
      brand: 'Net-a-Porter'
    };
  }
};

module.exports = { scrapeNetAPorter };