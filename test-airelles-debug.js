const axios = require('axios');
const cheerio = require('cheerio');

async function debugAirelles() {
  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    console.log('🔍 Debugging Airelles images...\n');

    // Check OG image
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log('OG Image:', ogImage);

    // Check if it's using Shopify CDN
    if (ogImage) {
      console.log('Uses cdn.shopify.com?', ogImage.includes('cdn.shopify.com'));
      console.log('Uses boutique.airelles.com?', ogImage.includes('boutique.airelles.com'));
    }

    // Check JSON-LD
    console.log('\nJSON-LD images:');
    $('script[type="application/ld+json"]').each((i, el) => {
      const content = $(el).html();
      try {
        const data = JSON.parse(content);
        if (data.image) {
          const images = Array.isArray(data.image) ? data.image : [data.image];
          images.forEach(img => {
            console.log(`  ${img}`);
            console.log(`    Uses cdn.shopify.com? ${img.includes('cdn.shopify.com')}`);
          });
        }
      } catch (e) {
        // Skip
      }
    });

    // Check for Shopify markers
    console.log('\n🛍️ Shopify detection:');
    console.log('Has Shopify.shop?', response.data.includes('Shopify.shop'));
    console.log('Has cdn.shopify.com?', response.data.includes('cdn.shopify.com'));
    console.log('Has myshopify.com?', response.data.includes('myshopify.com'));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugAirelles().catch(console.error);