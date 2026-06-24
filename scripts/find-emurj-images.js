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
    
    // Find all images with 100341 in the src
    const productImages = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const srcset = $(el).attr('srcset');
      
      if (src && src.includes('100341-')) {
        // Get parent classes to understand structure
        const parent = $(el).parent();
        const grandparent = parent.parent();
        
        console.log(`Image ${i+1}:`);
        console.log('  Parent tag:', parent.prop('tagName'));
        console.log('  Parent classes:', parent.attr('class'));
        console.log('  Grandparent classes:', grandparent.attr('class'));
        
        // Extract unique image ID
        const match = src.match(/100341-([a-f0-9\-]+)/);
        if (match && !productImages.includes(match[0])) {
          productImages.push(match[0]);
        }
      }
      
      // Also check srcset
      if (srcset && srcset.includes('100341-')) {
        const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
        const match = firstSrc.match(/100341-([a-f0-9\-]+)/);
        if (match && !productImages.includes(match[0])) {
          productImages.push(match[0]);
        }
      }
    });
    
    console.log('\nUnique product images:', productImages);
    
    // Check for responsive-image divs
    console.log('\n.responsive-image count:', $('.responsive-image').length);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
