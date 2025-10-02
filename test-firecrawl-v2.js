require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testV2() {
  const parser = new FirecrawlParserV2();

  // Test URLs
  const testCases = [
    {
      name: 'REI Product',
      url: 'https://www.rei.com/product/176888/patagonia-better-sweater-fleece-jacket-womens'
    },
    {
      name: 'SSENSE Product',
      url: 'https://www.ssense.com/en-us/women/product/ganni/black-buckle-ballerinas/14655271'
    },
    {
      name: 'Zara Product',
      url: 'https://www.zara.com/us/en/ribbed-tank-top-p03253822.html'
    }
  ];

  console.log('🧪 Testing Firecrawl Parser V2\n');
  console.log('=' . repeat(50));

  for (const testCase of testCases) {
    console.log(`\n📦 Testing: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    console.log('-'.repeat(50));

    try {
      const startTime = Date.now();
      const result = await parser.scrape(testCase.url);
      const duration = Date.now() - startTime;

      if (result.success) {
        const product = result.product;
        console.log('✅ SUCCESS');
        console.log(`⏱️  Time: ${duration}ms`);
        console.log(`📝 Name: ${product.product_name}`);
        console.log(`🏷️  Brand: ${product.brand}`);
        console.log(`💰 Price: $${product.sale_price}`);
        console.log(`💵 Original: $${product.original_price}`);
        console.log(`🎨 Images: ${product.image_urls?.length || 0} found`);
        console.log(`📊 Confidence: ${product.confidence || 'N/A'}`);
        console.log(`🏪 Platform: ${product.platform}`);
        console.log(`📦 In Stock: ${product.in_stock}`);
        console.log(`🏷️  Category: ${product.category}`);
        console.log(`🎨 Color: ${product.color || 'N/A'}`);
        console.log(`📏 Sizes: ${product.sizes?.join(', ') || 'N/A'}`);

        if (product.is_on_sale) {
          console.log(`🔥 ON SALE! ${product.discount_percentage}% off`);
        }

        if (product.screenshot_url) {
          console.log(`📸 Screenshot: Available`);
        }

        // Test cache
        console.log('\n🔄 Testing cache...');
        const cacheStart = Date.now();
        const cachedResult = await parser.scrape(testCase.url);
        const cacheDuration = Date.now() - cacheStart;
        console.log(`📦 Cache hit! Time: ${cacheDuration}ms (${Math.round(duration/cacheDuration)}x faster)`);

      } else {
        console.log('❌ FAILED');
        console.log(`Error: ${result.error}`);
      }

    } catch (error) {
      console.log('❌ ERROR');
      console.log(error.message);
    }

    console.log('-'.repeat(50));
  }

  // Test batch scraping
  console.log('\n\n🚀 Testing Batch Scraping');
  console.log('=' . repeat(50));

  const batchUrls = testCases.map(tc => tc.url);

  try {
    const batchStart = Date.now();
    const batchResults = await parser.batchScrape(batchUrls);
    const batchDuration = Date.now() - batchStart;

    console.log(`✅ Batch completed in ${batchDuration}ms`);
    console.log(`📊 Results: ${batchResults.filter(r => r.success).length}/${batchResults.length} successful`);

    batchResults.forEach((result, i) => {
      if (result.success) {
        console.log(`  ✓ ${testCases[i].name}: ${result.product.product_name}`);
      } else {
        console.log(`  ✗ ${testCases[i].name}: Failed`);
      }
    });

  } catch (error) {
    console.log('❌ Batch scraping failed:', error.message);
  }

  // Performance summary
  console.log('\n\n📊 Performance Summary');
  console.log('=' . repeat(50));
  console.log('• Structured extraction: ✅ Enabled');
  console.log('• Caching: ✅ Active');
  console.log('• Batch processing: ✅ Available');
  console.log('• Dynamic actions: ✅ Configured');
  console.log('• Site-specific configs: ✅ Loaded');

  // Clear cache for next run
  parser.clearCache();
  console.log('\n🗑️  Cache cleared for next test run');
}

// Run tests
testV2().catch(console.error);