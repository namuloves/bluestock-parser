require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function test() {
  console.log('API Key present:', !!process.env.FIRECRAWL_API_KEY);

  const parser = new FirecrawlParserV2();

  if (!parser.firecrawl) {
    console.log('❌ Firecrawl not initialized - API key missing');
    return;
  }

  console.log('✅ Firecrawl initialized');
  console.log('🔍 Testing Net-a-Porter product scraping...');

  const url = 'https://www.net-a-porter.com/en-us/shop/product/alaia/shoes/ballet-flats/criss-cross-leather-trimmed-calf-hair-ballet-flats/46376663162906557';

  try {
    const result = await parser.scrape(url);

    console.log('\n📊 Result:');
    console.log('Success:', result.success);

    if (result.success && result.product) {
      console.log('\n📦 Product Data:');
      console.log('Name:', result.product.product_name || result.product.name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.sale_price || result.product.price);
      console.log('\n🖼️  Images Found:', result.product.image_urls?.length || 0);

      if (result.product.image_urls && result.product.image_urls.length > 0) {
        console.log('\nFirst 5 image URLs:');
        result.product.image_urls.slice(0, 5).forEach((img, i) => {
          console.log(`  ${i+1}. ${img}`);
        });
      }
    } else {
      console.log('\n❌ Error:', result.error);
      console.log('Partial data:', result.partial_data);
    }
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

test();
