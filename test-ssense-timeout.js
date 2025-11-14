require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testMultipleUrls() {
  const urls = [
    {
      name: 'Issey Miyake (WORKED)',
      url: 'https://www.ssense.com/en-us/women/product/issey-miyake/purple-chiffon-twist-top/18498641'
    },
    {
      name: 'Rick Owens (TIMED OUT)',
      url: 'https://www.ssense.com/en-us/women/product/rick-owens-drkshdw/black-concordians-headband/18324131'
    }
  ];

  for (const testCase of urls) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    console.log('='.repeat(60));

    try {
      const parser = new FirecrawlParserV2();
      const startTime = Date.now();

      console.log('⏱️  Starting scrape...');
      const result = await parser.scrape(testCase.url);
      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ SUCCESS in ${duration}ms`);
        console.log('  Name:', result.product.product_name);
        console.log('  Brand:', result.product.brand);
        console.log('  Price:', result.product.sale_price);
        console.log('  Images:', result.product.image_urls?.length || 0);
      } else {
        console.log(`❌ FAILED after ${duration}ms`);
        console.log('  Error:', result.error);
      }

    } catch (error) {
      console.error(`💥 EXCEPTION: ${error.message}`);
      console.error('  Type:', error.constructor.name);
      if (error.response) {
        console.error('  HTTP Status:', error.response.status);
        console.error('  Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

testMultipleUrls();
