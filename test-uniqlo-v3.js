const UniversalParserV3 = require('./universal-parser-v3');

async function testUniqloPrice() {
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';

  const parser = new UniversalParserV3();
  const url = 'https://www.uniqlo.com/us/en/products/E459565-000/00';

  console.log('🚀 Testing Uniqlo Price Extraction with V3\n');
  console.log('=' .repeat(60));
  console.log(`URL: ${url}\n`);

  const startTime = Date.now();

  try {
    const result = await parser.parse(url);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Parse completed in ${elapsed}s\n`);

    console.log('📊 Extraction Results:');
    console.log('-'.repeat(40));
    console.log(`Name: ${result.name || '❌ Not found'}`);
    console.log(`Price: ${result.price ? `✅ $${result.price}` : '❌ Not found'}`);
    console.log(`Brand: ${result.brand || '❌ Not found'}`);
    console.log(`Images: ${result.images?.length || 0} found`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.priceSource) {
      console.log(`\n🎯 Price Source: ${result.priceSource}`);
    }

    if (result.images?.length > 0) {
      console.log(`\n🖼 Sample Image:`);
      console.log(`  ${result.images[0]}`);
    }

    const metrics = parser.getMetrics();
    console.log('\n📈 Parser Metrics:');
    console.log(`API Interceptions: ${metrics.apiInterceptions}`);
    console.log(`Success Rate: ${metrics.successRate}`);

    // Determine success
    const success = result.price && result.name && result.confidence > 0.5;
    console.log(`\n${success ? '✅ SUCCESS' : '❌ FAILED'}: ${success ? 'Successfully extracted price!' : 'Could not extract price'}`);

    if (result.price) {
      console.log('\n🎉 Price extraction working! API interception successful.');
    } else {
      console.log('\n💡 Price still not found. May need to examine specific API responses.');
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    console.log('Stack:', error.stack);
  }

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Test complete\n');
}

testUniqloPrice().catch(console.error);