const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeAritzia = async (url) => {
  console.log('🍁 Starting Aritzia scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 15000
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
      brand: 'Aritzia',
      sizes: [],
      colors: [],
      inStock: true
    };
    
    // Try JSON-LD
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product') {
          product.name = jsonData.name || '';
          product.description = jsonData.description || '';
          if (jsonData.image) {
            product.images = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
          }
          if (jsonData.offers) {
            const offer = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            product.price = offer.price ? `$${offer.price}` : '';
            product.inStock = offer.availability?.includes('InStock') || false;
          }
        }
      } catch (e) {}
    });
    
    // HTML fallbacks - Aritzia specific
    if (!product.name) {
      product.name = $('h1[data-test="pdp-title"]').text().trim() ||
                     $('.pdp-product-name').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.price) {
      const priceText = $('[data-test="pdp-price"]').text().trim() ||
                        $('.product-price').text().trim();
      if (priceText) {
        const match = priceText.match(/[\d,]+\.?\d*/);
        if (match) product.price = `$${match[0]}`;
      }
    }
    
    const originalPriceText = $('[data-test="pdp-compare-price"]').text().trim();
    if (originalPriceText) {
      const match = originalPriceText.match(/[\d,]+\.?\d*/);
      if (match) product.originalPrice = `$${match[0]}`;
    }
    
    if (!product.description) {
      product.description = $('[data-test="pdp-description"]').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - Aritzia specific
    if (product.images.length === 0) {
      $('[data-test="pdp-image"] img, .product-images img').each((i, img) => {
        const imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl && !product.images.includes(imageUrl)) {
          product.images.push(imageUrl.replace(/\?.*$/, ''));
        }
      });
    }
    
    // Sizes
    $('[data-test*="size"] button').each((i, el) => {
      const size = $(el).text().trim();
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('[data-test*="color"] button').each((i, el) => {
      const color = $(el).attr('aria-label') || $(el).text().trim();
      if (color && !product.colors.includes(color)) {
        product.colors.push(color);
      }
    });
    
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Aritzia product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Aritzia scraping error:', error.message);
    return { url, error: error.message, brand: 'Aritzia' };
  }
};

module.exports = { scrapeAritzia };