require('dotenv').config();
const FirecrawlParser = require('./scrapers/firecrawl-parser');

async function testFirecrawlSsense() {
  const parser = new FirecrawlParser();

  // Test SSENSE URL
  const url = 'https://www.ssense.com/en-us/women/product/still-kelly/black-workwear-trousers/18061791';

  console.log('🔥 Testing Firecrawl with SSENSE...');
  console.log('URL:', url);
  console.log('API Key set:', !!parser.apiKey);
  console.log('---');

  try {
    const result = await parser.scrape(url);

    if (result.success) {
      console.log('✅ Success!\n');
      console.log('Product:', JSON.stringify(result.product, null, 2));
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

testFirecrawlSsense();
