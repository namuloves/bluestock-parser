require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testREIScraping() {
  const parser = new FirecrawlParserV2();

  const testUrl = 'https://www.rei.com/product/176888/patagonia-better-sweater-fleece-jacket-womens';

  console.log('🔍 Testing REI Product Scraping with Firecrawl V2');
  console.log('=' . repeat(60));
  console.log(`URL: ${testUrl}\n`);

  try {
    const startTime = Date.now();

    // Clear cache to force fresh scrape
    parser.clearCache();
    console.log('🗑️  Cache cleared for fresh test\n');

    // Test with shorter timeout for debugging
    console.log('⏱️  Attempting with 45 second timeout...\n');

    const result = await parser.scrape(testUrl, {
      forceRefresh: true,
      timeout: 45000  // 45 second timeout
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ SUCCESS in ${duration}ms\n`);
      console.log('📦 Product Data:');
      console.log(`  Name: ${result.product.product_name}`);
      console.log(`  Brand: ${result.product.brand}`);
      console.log(`  Price: $${result.product.sale_price}`);
      console.log(`  Images: ${result.product.image_urls?.length || 0}`);
      console.log(`  Confidence: ${result.product.confidence || 'N/A'}`);
      console.log(`  Parser: ${result.product.parser || 'unknown'}`);

      if (result.product.image_urls?.length > 0) {
        console.log('\n🖼️  Sample Images:');
        result.product.image_urls.slice(0, 3).forEach((url, i) => {
          console.log(`  ${i + 1}. ${url.substring(0, 80)}...`);
        });
      }

      // Debug extracted data
      console.log('\n🔍 Raw Extracted Data:');
      console.log(JSON.stringify(result.raw || {}, null, 2));

    } else {
      console.log(`❌ FAILED in ${duration}ms`);
      console.log(`Error: ${result.error}`);

      // Check if it's a timeout
      if (result.error?.includes('timeout') || duration >= 30000) {
        console.log('\n⚠️  Request timed out. REI might be blocking or slow.');
        console.log('💡 Suggestions:');
        console.log('  1. Increase timeout in site config');
        console.log('  2. Add more wait actions');
        console.log('  3. Enable proxy for REI');
      }
    }

    // Show site config being used
    console.log('\n⚙️  Site Config Used:');
    const config = parser.getSiteConfig(testUrl);
    console.log(JSON.stringify(config, null, 2));

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('\nStack trace:', error.stack);

    // Check for specific error types
    if (error.message.includes('API key')) {
      console.log('\n⚠️  Firecrawl API key issue detected');
      console.log('Please check FIRECRAWL_API_KEY environment variable');
    }
  }
}

// Run the test
console.log('🚀 Starting REI scraping test...\n');
testREIScraping()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test crashed:', error);
    process.exit(1);
  });