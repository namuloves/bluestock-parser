const axios = require('axios');
const cheerio = require('cheerio');

async function inspectJSONLD() {
  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    console.log('🔍 Inspecting Airelles structured data...\n');

    // Check JSON-LD
    console.log('📋 JSON-LD data:');
    $('script[type="application/ld+json"]').each((i, el) => {
      const content = $(el).html();
      try {
        const data = JSON.parse(content);
        console.log(`\n${i + 1}. Type: ${data['@type'] || 'unknown'}`);

        if (data.image) {
          console.log('   Images:', JSON.stringify(data.image, null, 2));
        }
      } catch (e) {
        console.log(`${i + 1}. Failed to parse:`, e.message);
      }
    });

    // Check for Shopify product JSON
    console.log('\n\n📦 Shopify product JSON:');
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('"featured_image"') || content.includes('"images"')) {
        console.log(`\nScript ${i} contains product data:`);
        // Try to extract the product object
        const productMatch = content.match(/{\s*"id":\s*\d+[^}]*"featured_image"[^}]*}/);
        if (productMatch) {
          try {
            // Find the full product JSON
            const jsonMatch = content.match(/{[^]*?"featured_image"[^]*?}/);
            if (jsonMatch) {
              const product = JSON.parse(jsonMatch[0]);
              console.log('   featured_image:', product.featured_image);
              console.log('   images:', product.images);
            }
          } catch (e) {
            // Try a different approach
            console.log('   Contains image data but couldn\'t parse as JSON');
            const imageMatches = content.match(/https:\/\/[^"']+\.jpg[^"']*/g);
            if (imageMatches) {
              console.log('   Found image URLs:', imageMatches.filter(url => url.includes('porte-cle')));
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspectJSONLD().catch(console.error);
