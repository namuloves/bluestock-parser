require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testFirecrawl() {
  const url = 'https://www.ssense.com/en-us/women/product/issey-miyake/purple-chiffon-twist-top/18498641';

  console.log('🧪 Testing SSENSE with Firecrawl V2 (current method)...');
  console.log('URL:', url);
  console.log('API Key set:', !!process.env.FIRECRAWL_API_KEY);
  console.log('---\n');

  try {
    const parser = new FirecrawlParserV2();
    const startTime = Date.now();
    const result = await parser.scrape(url);
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log('\n✅ SUCCESS! Firecrawl V2 works!');
      console.log('Duration:', duration + 'ms');
      console.log('\n📊 Product Data:');
      console.log('  Name:', result.product.product_name);
      console.log('  Brand:', result.product.brand);
      console.log('  Price:', result.product.price, result.product.currency);
      console.log('  Images:', result.product.image_urls?.length || 0);
      console.log('  Sizes:', result.product.available_sizes?.length || 0);
      console.log('  Description length:', result.product.description?.length || 0);

      console.log('\n🖼️  Image URLs:');
      (result.product.image_urls || []).slice(0, 3).forEach((img, i) => {
        console.log(`  ${i + 1}. ${img}`);
      });
      if ((result.product.image_urls?.length || 0) > 3) {
        console.log(`  ... and ${result.product.image_urls.length - 3} more`);
      }

      console.log('\n👕 Sizes:', (result.product.available_sizes || []).join(', '));

      console.log('\n📦 Full product object:');
      console.log(JSON.stringify(result.product, null, 2));

    } else {
      console.error('\n❌ FAILED! Firecrawl returned unsuccessful result');
      console.error('Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ FAILED! Firecrawl threw an error');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFirecrawl();
