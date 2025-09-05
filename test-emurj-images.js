const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://emurj.com/womens/ann-demeulemeester/lo-micro-boxer-shorts/100341';

(async () => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    console.log('=== Checking for images ===');
    
    // Check all img tags
    const allImages = new Set();
    
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const srcset = $(el).attr('srcset');
      
      if (src && src.includes('files')) {
        allImages.add(src);
      }
      
      if (srcset) {
        // Parse srcset for multiple images
        const srcsetImages = srcset.split(',').map(s => s.trim().split(' ')[0]);
        srcsetImages.forEach(img => {
          if (img.includes('files')) {
            allImages.add(img);
          }
        });
      }
    });
    
    console.log('Found', allImages.size, 'unique images:');
    Array.from(allImages).forEach(img => console.log(img));
    
    // Check for JSON data with images
    $('script[type="application/json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json.media || json.images || json.product) {
          console.log('\n=== Found JSON with potential images ===');
          console.log(JSON.stringify(json, null, 2).slice(0, 500));
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
