require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testBatchScraping() {
  const parser = new FirecrawlParserV2();

  // Test batch scraping with multiple product URLs
  const testUrls = [
    'https://www.zara.com/us/en/textured-dress-p02298168.html',
    'https://www.zara.com/us/en/ribbed-halter-top-p03253307.html',
    'https://www.zara.com/us/en/flowing-shirt-p08372450.html'
  ];

  console.log('🚀 Testing Batch Scraping with Firecrawl V2');
  console.log('=' . repeat(50));
  console.log(`\nScraping ${testUrls.length} products in parallel...\n`);

  try {
    const startTime = Date.now();

    // Test batch scraping
    const results = await parser.batchScrape(testUrls, {
      timeout: 60000
    });

    const duration = Date.now() - startTime;

    console.log(`✅ Batch scraping completed in ${duration}ms`);
    console.log(`⏱️  Average time per product: ${Math.round(duration / testUrls.length)}ms\n`);

    // Display results
    results.forEach((result, index) => {
      console.log('-'.repeat(50));
      console.log(`Product ${index + 1}: ${testUrls[index].split('/').pop()}`);

      if (result.success) {
        const product = result.product;
        console.log(`✅ Success`);
        console.log(`  📝 Name: ${product.product_name}`);
        console.log(`  💰 Price: $${product.sale_price}`);
        console.log(`  🎨 Images: ${product.image_urls?.length || 0}`);
        console.log(`  📊 Confidence: ${product.confidence || 'N/A'}`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    });

    // Test cache effectiveness
    console.log('\n' + '=' . repeat(50));
    console.log('🔄 Testing Cache Effectiveness\n');

    const cacheStart = Date.now();
    const cachedResults = await parser.batchScrape(testUrls);
    const cacheDuration = Date.now() - cacheStart;

    console.log(`✅ Cached batch completed in ${cacheDuration}ms`);
    console.log(`⚡ Speed improvement: ${Math.round(duration / cacheDuration)}x faster`);
    console.log(`💰 Cost savings: 100% (no API calls for cached items)`);

    // Show cache stats
    console.log('\n📊 Cache Statistics:');
    console.log(`  • Cache size: ${parser.cache.size} items`);
    console.log(`  • Memory usage: ~${JSON.stringify(Array.from(parser.cache.values())).length / 1024}KB`);

    // Compare with individual scraping
    console.log('\n' + '=' . repeat(50));
    console.log('📊 Comparison: Batch vs Individual\n');

    parser.clearCache(); // Clear cache for fair comparison

    const individualStart = Date.now();
    const individualResults = [];

    for (const url of testUrls) {
      const result = await parser.scrape(url);
      individualResults.push(result);
    }

    const individualDuration = Date.now() - individualStart;

    console.log(`Individual scraping: ${individualDuration}ms`);
    console.log(`Batch scraping: ${duration}ms`);
    console.log(`\n✅ Batch is ${((individualDuration - duration) / individualDuration * 100).toFixed(1)}% faster!`);

  } catch (error) {
    console.error('❌ Batch scraping test failed:', error.message);
    console.error(error.stack);
  }

  // Clean up
  parser.clearCache();
  console.log('\n🗑️  Cache cleared');
}

// Run the test
testBatchScraping().catch(console.error);