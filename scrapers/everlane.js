const axios = require('axios');
const cheerio = require('cheerio');

const scrapeEverlane = async (url) => {
  console.log('♻️ Starting Everlane scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    
    const response = await axios.get(url, {
      headers,
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Everlane',
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
    
    // HTML fallbacks
    if (!product.name) {
      product.name = $('h1[data-testid="pdp-title"]').text().trim() ||
                     $('.product-title').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.price) {
      const priceText = $('[data-testid="pdp-price"]').text().trim() ||
                        $('.product-price').text().trim();
      if (priceText) {
        const match = priceText.match(/[\d,]+\.?\d*/);
        if (match) product.price = `$${match[0]}`;
      }
    }
    
    if (!product.description) {
      product.description = $('[data-testid="pdp-description"]').text().trim() ||
                            $('.product-description').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images
    if (product.images.length === 0) {
      $('.product-images img, [data-testid="pdp-image"]').each((i, img) => {
        const imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl && !product.images.includes(imageUrl)) {
          product.images.push(imageUrl.replace(/\?.*$/, ''));
        }
      });
    }
    
    // Sizes
    $('[data-testid*="size"] button, .size-selector button').each((i, el) => {
      const size = $(el).text().trim();
      if (size && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Colors
    $('[data-testid*="color"] button, .color-selector button').each((i, el) => {
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
    
    console.log('✅ Successfully scraped Everlane product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Everlane scraping error:', error.message);
    return { url, error: error.message, brand: 'Everlane' };
  }
};

module.exports = { scrapeEverlane };