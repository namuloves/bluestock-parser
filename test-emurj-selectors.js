const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const url = 'https://emurj.com/womens/ann-demeulemeester/lo-micro-boxer-shorts/100341';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Test different selectors
    console.log('=== Testing selectors ===');
    
    console.log('\n.product__media img count:', $('.product__media img').length);
    console.log('.product__image img count:', $('.product__image img').length);
    console.log('img[itemprop="image"] count:', $('img[itemprop="image"]').length);
    
    // Look for swiper or slider images
    console.log('\n.swiper-slide img count:', $('.swiper-slide img').length);
    console.log('.slider img count:', $('.slider img').length);
    console.log('.product-single__photos img count:', $('.product-single__photos img').length);
    
    // Check for data attributes
    console.log('\n[data-product-images] count:', $('[data-product-images]').length);
    console.log('[data-media] count:', $('[data-media]').length);
    
    // Find first few unique image srcs
    const uniqueImages = new Set();
    $('.swiper-slide img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.includes('100341')) {
        // Extract base filename
        const match = src.match(/100341-[a-f0-9\-]+/);
        if (match) {
          uniqueImages.add(match[0]);
        }
      }
    });
    
    console.log('\nUnique product images found:', Array.from(uniqueImages));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
