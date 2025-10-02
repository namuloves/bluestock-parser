require('dotenv').config();
const FirecrawlParser = require('./scrapers/firecrawl-parser');

async function testFirecrawlSimple() {
  const parser = new FirecrawlParser();

  // Test with a site that should work - Zara
  const url = 'https://www.zara.com/us/en/technical-bomber-jacket-p08073403.html';

  console.log('🔥 Testing Firecrawl with Zara (simple test)...');
  console.log('URL:', url);
  console.log('API Key set:', !!parser.apiKey);
  console.log('---');

  try {
    const result = await parser.scrape(url, { timeout: 90000 });

    if (result.success) {
      console.log('✅ Success!\n');
      console.log('Product Name:', result.product.product_name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.sale_price);
      console.log('Images:', result.product.image_urls?.length || 0);
      console.log('\nFull product:');
      console.log(JSON.stringify(result.product, null, 2));
    } else {
      console.log('❌ Failed');
      console.log('Error:', result.error);
      if (result.partial_data) {
        console.log('\nPartial data:', JSON.stringify(result.partial_data, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testFirecrawlSimple();
