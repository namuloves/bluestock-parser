require('dotenv').config();
const FirecrawlParser = require('./scrapers/firecrawl-parser');

async function testFirecrawlREI() {
  const parser = new FirecrawlParser();

  // Test REI URL - popular product
  const url = 'https://www.rei.com/product/176888/patagonia-better-sweater-fleece-jacket-womens';

  console.log('🔥 Testing Firecrawl with REI...');
  console.log('URL:', url);
  console.log('API Key set:', !!parser.apiKey);
  console.log('---');

  try {
    const result = await parser.scrape(url);

    if (result.success) {
      console.log('✅ Success!\n');
      console.log('Product Name:', result.product.product_name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.sale_price);
      console.log('Original Price:', result.product.original_price);
      console.log('On Sale:', result.product.is_on_sale);
      console.log('Images:', result.product.image_urls?.length || 0, 'images');
      console.log('Description:', result.product.description?.substring(0, 100) + '...');
      console.log('\nFull product data:');
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

testFirecrawlREI();
