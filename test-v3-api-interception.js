const UniversalParserV3 = require('./universal-parser-v3');

const testUrls = [
  {
    site: 'uniqlo',
    url: 'https://www.uniqlo.com/us/en/products/E459565-000/00',
    expected: 'Should extract price via API'
  },
  {
    site: 'nordstrom',
    url: 'https://www.nordstrom.com/s/nike-dunk-low-retro-sneaker-men/7467933',
    expected: 'Should intercept product API'
  },
  {
    site: 'ssense',
    url: 'https://www.ssense.com/en-us/men/product/adidas-originals/green-samba-og-sneakers/13567281',
    expected: 'Should capture GraphQL data'
  }
];

async function testApiInterception() {
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';

  const parser = new UniversalParserV3();

  console.log('🚀 Testing Universal Parser V3 with API Interception\n');
  console.log('=' .repeat(60));

  const results = [];

  for (const test of testUrls) {
    console.log(`\n📍 Testing ${test.site.toUpperCase()}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.expected}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();

    try {
      const result = await parser.parse(test.url);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n📊 Results (${elapsed}s):`);

      // Show extraction details
      console.log(`\n  Data Sources:`);
      if (result.nameSource) console.log(`    Name from: ${result.nameSource}`);
      if (result.priceSource) console.log(`    Price from: ${result.priceSource}`);
      if (result.brandSource) console.log(`    Brand from: ${result.brandSource}`);
      if (result.imagesSource) console.log(`    Images from: ${result.imagesSource}`);

      console.log(`\n  Extracted Data:`);
      console.log(`    ✅ Name: ${result.name ? result.name.substring(0, 50) : '❌ Not found'}`);
      console.log(`    ✅ Price: ${result.price ? '$' + result.price : '❌ Not found'}`);
      console.log(`    ✅ Brand: ${result.brand || '❌ Not found'}`);
      console.log(`    ✅ Images: ${result.images?.length || 0} found`);
      console.log(`    📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);

      if (result.images?.length > 0) {
        console.log(`    🖼  First image: ${result.images[0].substring(0, 60)}...`);
      }

      const success = result.price && result.name && result.confidence > 0.5;
      results.push({
        site: test.site,
        success,
        confidence: result.confidence,
        hasPrice: !!result.price,
        priceFromApi: result.priceSource === 'api',
        time: elapsed
      });

      console.log(`\n  ${success ? '✅ SUCCESS' : '❌ FAILED'} - ${success ? 'Extracted all key data' : 'Missing critical data'}`);

    } catch (error) {
      console.log(`\n  ❌ Parse failed: ${error.message}`);
      results.push({
        site: test.site,
        success: false,
        error: error.message
      });
    }

    console.log('-'.repeat(60));

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📈 SUMMARY');
  console.log('=' .repeat(60));

  const metrics = parser.getMetrics();
  console.log('\n📊 Parser Metrics:');
  console.log(`  Total attempts: ${metrics.attempts}`);
  console.log(`  Successes: ${metrics.successes}`);
  console.log(`  Failures: ${metrics.failures}`);
  console.log(`  Success rate: ${metrics.successRate}`);
  console.log(`  ${metrics.apiInterceptionRate}`);

  console.log('\n📊 Strategy Performance:');
  console.log(`  Direct: ${metrics.byStrategy.direct.successes}/${metrics.byStrategy.direct.attempts}`);
  console.log(`  Puppeteer: ${metrics.byStrategy.puppeteer.successes}/${metrics.byStrategy.puppeteer.attempts}`);
  console.log(`  API: ${metrics.byStrategy.api.successes}/${metrics.byStrategy.api.attempts}`);

  console.log('\n📝 Test Results:');
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const apiIcon = r.priceFromApi ? '🎯' : '📄';
    console.log(`  ${icon} ${r.site}: ${r.hasPrice ? apiIcon + ' Has price' : 'No price'} | ${(r.confidence * 100).toFixed(0)}% confidence | ${r.time}s`);
  });

  // Calculate improvement
  const pricesExtracted = results.filter(r => r.hasPrice).length;
  const apiPrices = results.filter(r => r.priceFromApi).length;
  console.log(`\n🎯 API Interception Impact:`);
  console.log(`  Prices extracted: ${pricesExtracted}/${results.length}`);
  console.log(`  Via API interception: ${apiPrices}/${pricesExtracted}`);

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Test complete\n');
}

testApiInterception().catch(console.error);