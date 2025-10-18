const UniversalParserV3Resilient = require('./universal-parser-v3-resilient');

async function testResilientParser() {
  console.log('🛡️ Testing Resilient Parser with Retry & Fallback\n');
  console.log('=' .repeat(60));

  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';
  const parser = new UniversalParserV3Resilient();

  // Test URLs with varying difficulty
  const testCases = [
    {
      name: 'Easy - Uniqlo (should succeed on first try)',
      url: 'https://www.uniqlo.com/us/en/products/E459565-000/00',
      expectedStrategy: 'puppeteer'
    },
    {
      name: 'Medium - SSENSE (may need retry)',
      url: 'https://www.ssense.com/en-us/men/product/adidas-originals/green-samba-og-sneakers/13567281',
      expectedStrategy: 'puppeteer'
    },
    {
      name: 'Hard - Nordstrom (likely needs retries)',
      url: 'https://www.nordstrom.com/s/nike-dunk-low-retro-sneaker-men/7467933',
      expectedStrategy: 'puppeteer'
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();

    try {
      const result = await parser.parse(testCase.url);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n✅ Success in ${elapsed}s`);
      console.log(`   Name: ${result.name ? result.name.substring(0, 40) : '❌ Not found'}`);
      console.log(`   Price: ${result.price ? '$' + result.price : '❌ Not found'}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Source: ${result.source || 'unknown'}`);

      results.push({
        test: testCase.name,
        success: true,
        time: elapsed,
        confidence: result.confidence
      });

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n❌ Failed after ${elapsed}s`);
      console.log(`   Error: ${error.message}`);

      results.push({
        test: testCase.name,
        success: false,
        time: elapsed,
        error: error.message
      });
    }

    console.log('-'.repeat(60));

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Get metrics
  console.log('\n📊 Resilience Metrics');
  console.log('=' .repeat(60));

  const metrics = await parser.getFullMetrics();

  console.log('\n🔄 Retry Statistics:');
  console.log(`   Successful retries: ${metrics.retry.successfulRetries || 0}`);
  console.log(`   Failed retries: ${metrics.retry.failedRetries || 0}`);
  console.log(`   Success rate: ${metrics.retry.successRate || 'N/A'}`);

  if (metrics.retry.byDomain) {
    console.log('\n   By Domain:');
    for (const [domain, stats] of Object.entries(metrics.retry.byDomain)) {
      console.log(`     ${domain}: ${stats.successes}/${stats.attempts} attempts`);
    }
  }

  console.log('\n🔗 Fallback Chain:');
  console.log(`   Strategies: ${metrics.resilience.strategies.join(' → ')}`);

  console.log('\n📦 Cache Performance:');
  console.log(`   Hit rate: ${metrics.cache.hitRate}`);
  console.log(`   Total hits: ${metrics.cache.hits}`);
  console.log(`   Total misses: ${metrics.cache.misses}`);

  // Summary
  console.log('\n📈 Test Summary');
  console.log('=' .repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgTime = results.reduce((sum, r) => sum + parseFloat(r.time), 0) / results.length;

  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Average time: ${avgTime.toFixed(1)}s`);
  console.log(`🛡️ Resilience rate: ${((successful / results.length) * 100).toFixed(1)}%`);

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Resilient parser test complete!\n');
  process.exit(0);
}

testResilientParser().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});