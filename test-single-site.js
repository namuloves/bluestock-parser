const UniversalParserV2 = require('./universal-parser-v2');

async function testSingleSite() {
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';

  const parser = new UniversalParserV2();

  // Test COS which was failing with 403
  const url = 'https://www.cos.com/en-usd/men/shirts/product.short-sleeved-linen-shirt-brown.1216632001.html';

  console.log('🚀 Testing Single Site with Puppeteer\n');
  console.log(`📍 URL: ${url}\n`);

  const startTime = Date.now();

  try {
    const result = await parser.parse(url);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Success! (${elapsed}s)`);
    console.log('\n📊 Results:');
    console.log(`  Name: ${result.name || '❌ Not found'}`);
    console.log(`  Price: ${result.price ? '$' + result.price : '❌ Not found'}`);
    console.log(`  Brand: ${result.brand || '❌ Not found'}`);
    console.log(`  Images: ${result.images?.length || 0} found`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.images?.length > 0) {
      console.log('\n🖼  Images:');
      result.images.slice(0, 3).forEach((img, i) => {
        console.log(`  ${i + 1}. ${img}`);
      });
    }

    if (result.description) {
      console.log(`\n📝 Description: ${result.description.substring(0, 100)}...`);
    }

  } catch (error) {
    console.log(`\n❌ Failed: ${error.message}`);
    console.log('Stack trace:', error.stack);
  }

  // Cleanup
  await parser.cleanup();

  console.log('\n✅ Test complete\n');
}

testSingleSite().catch(console.error);