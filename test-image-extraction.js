const axios = require('axios');
const cheerio = require('cheerio');

async function testImageExtraction() {
  const url = 'https://us.boden.com/products/helen-cord-kilt-skirt-navy';

  console.log('🔍 Testing image extraction for:', url);
  console.log('─'.repeat(60));

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Test various image selectors
    const imageSelectors = [
      // Common e-commerce selectors
      '.product-image img',
      '.product__media img',
      '.product-photo img',
      '.gallery img',
      '.media img',
      '[data-role="product-image"] img',
      '.swiper-slide img',
      '.product-images img',
      '.product-gallery img',

      // Specific platform selectors
      '.product__main-photos img',
      '.product-single__photos img',
      '.product-image-main img',
      '.pdp-image img',
      '.product-detail-images img',

      // Generic img tags with filters
      'img[src*="product"]',
      'img[src*="cdn"]',
      'img[data-src]',
      'img[srcset]',

      // Shopify specific
      'img[data-product-featured-image]',
      'img[data-product-image]',
      '.product__image img',

      // Look for images in picture elements
      'picture img',
      'picture source'
    ];

    console.log('\n📸 Testing selectors:\n');

    const foundImages = new Set();

    imageSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ ${selector}: ${elements.length} found`);

        elements.slice(0, 3).each((i, elem) => {
          // Try different attributes
          const src = $(elem).attr('src') ||
                     $(elem).attr('data-src') ||
                     $(elem).attr('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                     $(elem).attr('data-srcset')?.split(',')[0]?.trim().split(' ')[0];

          if (src && !src.includes('data:image') && !src.includes('blank.gif')) {
            // Ensure full URL
            let fullUrl = src;
            if (src.startsWith('//')) {
              fullUrl = 'https:' + src;
            } else if (src.startsWith('/')) {
              fullUrl = 'https://us.boden.com' + src;
            }

            foundImages.add(fullUrl);
            console.log(`   [${i}] ${fullUrl.substring(0, 80)}...`);
          }
        });
      }
    });

    // Also check JSON-LD
    console.log('\n📊 Checking JSON-LD for images:');
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json['@type'] === 'Product' && json.image) {
          console.log('✅ Found in JSON-LD:');
          const images = Array.isArray(json.image) ? json.image : [json.image];
          images.forEach(img => {
            foundImages.add(img);
            console.log(`   ${img.substring(0, 80)}...`);
          });
        }
      } catch (e) {
        // Silent
      }
    });

    // Check meta tags
    console.log('\n🏷️ Checking meta tags:');
    const metaImage = $('meta[property="og:image"]').attr('content');
    if (metaImage) {
      console.log('✅ Found in og:image:', metaImage.substring(0, 80) + '...');
      foundImages.add(metaImage);
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`📸 Total unique images found: ${foundImages.size}`);

    if (foundImages.size > 0) {
      console.log('\n🖼️ All found images:');
      Array.from(foundImages).slice(0, 10).forEach((img, i) => {
        console.log(`${i + 1}. ${img}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImageExtraction();