const axios = require('axios');
const cheerio = require('cheerio');

async function testShopifyImages() {
  const url = 'https://nhuhn.com/products/gothic-preppy-oversized-jacket?variant=41784140562455';

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);

  // Look for Shopify product JSON
  $('script[type="application/json"]').each((i, elem) => {
    const content = $(elem).html();
    if (content && content.includes('product')) {
      try {
        const json = JSON.parse(content);
        if (json.product) {
          console.log('Found product JSON!');
          console.log('Images in JSON:', json.product.images?.length || 0);
          console.log('Media in JSON:', json.product.media?.length || 0);

          if (json.product.media?.length > 0) {
            console.log('\nMedia items:');
            json.product.media.forEach((m, i) => {
              console.log(`${i+1}. Type: ${m.media_type}, src: ${m.src || m.preview_image?.src}`);
            });
          }

          if (json.product.images?.length > 0) {
            console.log('\nImage items:');
            json.product.images.forEach((img, i) => {
              console.log(`${i+1}. ${img}`);
            });
          }
        }
      } catch(e) {
        // Skip parse errors
      }
    }
  });

  // Also look for images in HTML
  console.log('\n\nImages in HTML:');
  const imageSelectors = [
    '.product__media img',
    '.product-single__media img',
    '.product-image img',
    '[data-product-images] img',
    '.product__main-photos img'
  ];

  for (const selector of imageSelectors) {
    const imgs = $(selector);
    if (imgs.length > 0) {
      console.log(`Found ${imgs.length} images with selector: ${selector}`);
      imgs.slice(0, 3).each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) console.log(`  ${i+1}. ${src}`);
      });
      break;
    }
  }
}

testShopifyImages().catch(console.error);