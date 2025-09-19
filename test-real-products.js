const UniversalParserV2 = require('./universal-parser-v2');
const testSuite = require('./test-suite-real.json');

async function runRealProductTests() {
  process.env.UNIVERSAL_LOG_LEVEL = 'normal';

  const parser = new UniversalParserV2();
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  console.log('🚀 Running Real Product Test Suite\n');
  console.log('=' .repeat(60));
  console.log(`Testing ${testSuite.test_products.length} products\n`);

  for (const test of testSuite.test_products) {
    console.log(`\n📍 Testing ${test.site.toUpperCase()}`);
    console.log(`   URL: ${test.url}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();
    let result;
    let attempts = 0;
    let success = false;

    // Retry logic
    while (attempts < (testSuite.test_config.max_retries || 1) && !success) {
      attempts++;
      if (attempts > 1) {
        console.log(`   🔄 Retry attempt ${attempts}...`);
      }

      try {
        result = await parser.parse(test.url);
        success = true;
      } catch (error) {
        console.log(`   ⚠️  Attempt ${attempts} failed: ${error.message}`);
        if (attempts < testSuite.test_config.max_retries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!success || !result) {
      console.log(`   ❌ FAILED - Could not parse after ${attempts} attempts`);
      results.failed++;
      results.details.push({
        site: test.site,
        status: 'FAILED',
        error: 'Parse failed'
      });
      continue;
    }

    // Check expectations
    const checks = {
      name: test.expected.has_name ? !!result.name : true,
      price: test.expected.has_price ? !!result.price : true,
      images: test.expected.has_images ? (result.images?.length > 0) : true,
      confidence: result.confidence >= (test.expected.min_confidence || 0)
    };

    const allPassed = Object.values(checks).every(v => v);

    console.log(`\n   📊 Results (${elapsed}s):`);
    console.log(`      ${checks.name ? '✅' : '❌'} Name: ${result.name ? result.name.substring(0, 50) : 'Not found'}`);
    console.log(`      ${checks.price ? '✅' : '❌'} Price: ${result.price ? '$' + result.price : 'Not found'}`);
    console.log(`      ${checks.images ? '✅' : '❌'} Images: ${result.images?.length || 0} found`);
    console.log(`      ${checks.confidence ? '✅' : '❌'} Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.brand) {
      console.log(`      ℹ️  Brand: ${result.brand}`);
    }

    if (allPassed) {
      console.log(`   ✅ PASSED`);
      results.passed++;
    } else {
      console.log(`   ❌ FAILED - Some checks did not pass`);
      results.failed++;
    }

    results.details.push({
      site: test.site,
      status: allPassed ? 'PASSED' : 'FAILED',
      confidence: result.confidence,
      checks,
      time: elapsed
    });

    // Delay between tests
    if (testSuite.test_config.delay_between_tests) {
      await new Promise(resolve => setTimeout(resolve, testSuite.test_config.delay_between_tests));
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📈 TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${testSuite.test_products.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / testSuite.test_products.length) * 100).toFixed(1)}%`);

  console.log('\n📊 PARSER METRICS:');
  const metrics = parser.getMetrics();
  console.log(`Total attempts: ${metrics.attempts}`);
  console.log(`Successful extractions: ${metrics.successes}`);
  console.log(`Failed extractions: ${metrics.failures}`);
  console.log(`Overall success rate: ${metrics.successRate}`);

  console.log('\n📊 STRATEGY BREAKDOWN:');
  console.log(`Direct fetch: ${metrics.byStrategy.direct.successes}/${metrics.byStrategy.direct.attempts}`);
  console.log(`Puppeteer: ${metrics.byStrategy.puppeteer.successes}/${metrics.byStrategy.puppeteer.attempts}`);

  console.log('\n📝 DETAILED RESULTS:');
  results.details.forEach(detail => {
    const icon = detail.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${detail.site}: ${(detail.confidence * 100).toFixed(0)}% confidence (${detail.time}s)`);
  });

  // Cleanup
  await parser.cleanup();

  // Save results to file
  const fs = require('fs').promises;
  await fs.writeFile(
    'test-results-real.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Results saved to test-results-real.json');

  console.log('\n✅ Test suite complete\n');
}

runRealProductTests().catch(console.error);