const axios = require('axios');
const cheerio = require('cheerio');

async function testWConceptImages() {
  const url = 'https://www.wconcept.com/product/pm-classic-pleated-midi-skirt/720334516.html';

  console.log('🔍 Testing W Concept image extraction for:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    console.log('\n📋 Image Analysis:');

    // Check meta image
    const metaImage = $('meta[property="og:image"]').attr('content');
    console.log('Meta OG Image:', metaImage);

    // Look for image galleries/carousels
    console.log('\n🖼️ Gallery Images:');
    $('.product-image img, .product-gallery img, .image-gallery img, .product-slider img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        console.log(`Image ${i + 1}:`, src);
      }
    });

    // Look for thumbnail navigation
    console.log('\n🔍 Thumbnail Images:');
    $('.thumbnail img, .thumb img, .nav-thumb img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        console.log(`Thumb ${i + 1}:`, src);
      }
    });

    // Look for structured data with images
    console.log('\n📊 Structured Data Images:');
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        if (data.image) {
          console.log('JSON-LD Images:', Array.isArray(data.image) ? data.image : [data.image]);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Look for data attributes or other patterns
    console.log('\n🔧 Other Image Patterns:');
    $('[data-image], [data-src*="jpg"], [data-src*="png"], [data-lazy]').each((i, elem) => {
      const src = $(elem).attr('data-image') || $(elem).attr('data-src') || $(elem).attr('data-lazy');
      if (src && src.includes('http')) {
        console.log(`Data Image ${i + 1}:`, src);
      }
    });

    // Look for JavaScript variables containing images
    console.log('\n⚡ JavaScript Image Variables:');
    $('script').each((i, elem) => {
      const content = $(elem).html();
      if (content && content.includes('image') && content.includes('http')) {
        // Look for common patterns
        const patterns = [
          /images?\s*:\s*\[(.*?)\]/g,
          /"images?"\s*:\s*\[(.*?)\]/g,
          /productImages?\s*=\s*\[(.*?)\]/g,
          /gallery\s*:\s*\[(.*?)\]/g
        ];

        patterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              console.log('JS Pattern found:', match.substring(0, 200) + '...');
            });
          }
        });
      }
    });

  } catch (error) {
    console.error('❌ Error testing W Concept images:', error.message);
  }
}

testWConceptImages();