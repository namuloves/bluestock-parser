const UniversalParserV2 = require('./universal-parser-v2');

const testUrls = [
  'https://www.zara.com/us/en/ribbed-knit-polo-shirt-p03597402.html',
  'https://www.cos.com/en-usd/men/shirts/product.short-sleeved-linen-shirt-brown.1216632001.html',
  'https://www2.hm.com/en_us/productpage.1227154002.html',
  'https://www.uniqlo.com/us/en/products/E459565-000/00',
  'https://www.aritzia.com/us/en/product/contour-longsleeve/106232.html'
];

async function testParser() {
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';

  const parser = new UniversalParserV2();

  console.log('🚀 Testing Universal Parser V2\n');
  console.log('=' .repeat(60));

  const results = [];

  for (const url of testUrls) {
    console.log(`\n📍 Testing: ${url}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();

    try {
      const result = await parser.parse(url);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n📊 Results (${elapsed}s):`);
      console.log(`  ✅ Name: ${result.name ? result.name.substring(0, 50) : '❌ Not found'}`);
      console.log(`  ✅ Price: ${result.price ? '$' + result.price : '❌ Not found'}`);
      console.log(`  ✅ Brand: ${result.brand || '❌ Not found'}`);
      console.log(`  ✅ Images: ${result.images?.length || 0} found`);
      console.log(`  📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);

      if (result.images?.length > 0) {
        console.log(`  🖼  First image: ${result.images[0].substring(0, 60)}...`);
      }

      results.push({
        url,
        success: result.confidence > 0.5,
        confidence: result.confidence,
        time: elapsed
      });

    } catch (error) {
      console.log(`  ❌ Parse failed: ${error.message}`);
      results.push({ url, success: false, confidence: 0 });
    }

    console.log('-'.repeat(60));

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n📈 Summary:');
  console.log('=' .repeat(60));

  const metrics = parser.getMetrics();
  console.log('Overall Metrics:');
  console.log(`  Total attempts: ${metrics.attempts}`);
  console.log(`  Successes: ${metrics.successes}`);
  console.log(`  Failures: ${metrics.failures}`);
  console.log(`  Success rate: ${metrics.successRate}`);
  console.log('\nStrategy Performance:');
  console.log(`  Direct: ${metrics.byStrategy.direct.successes}/${metrics.byStrategy.direct.attempts}`);
  console.log(`  Puppeteer: ${metrics.byStrategy.puppeteer.successes}/${metrics.byStrategy.puppeteer.attempts}`);

  console.log('\nPer-site Results:');
  results.forEach(r => {
    const site = new URL(r.url).hostname;
    console.log(`  ${r.success ? '✅' : '❌'} ${site}: ${(r.confidence * 100).toFixed(0)}% (${r.time || '-'}s)`);
  });

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Test complete\n');
}

testParser().catch(console.error);