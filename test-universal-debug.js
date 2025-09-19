const UniversalParser = require('./universal-parser');

// Test with real URLs from various sites
const testUrls = [
  'https://www.zara.com/us/en/ribbed-knit-polo-shirt-p03597402.html',
  'https://www.cos.com/en-usd/men/shirts/product.short-sleeved-linen-shirt-brown.1216632001.html',
  'https://www2.hm.com/en_us/productpage.1227154002.html',
  'https://www.uniqlo.com/us/en/products/E459565-000/00',
  'https://www.aritzia.com/us/en/product/contour-longsleeve/106232.html'
];

async function debugParser() {
  // Set verbose logging
  process.env.UNIVERSAL_LOG_LEVEL = 'verbose';
  process.env.UNIVERSAL_MODE = 'shadow';

  const parser = new UniversalParser();

  // Wait for patterns to load
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n🔍 Starting Universal Parser Debug Test\n');
  console.log('=' .repeat(60));

  for (const url of testUrls) {
    console.log(`\n📍 Testing: ${url}`);
    console.log('-'.repeat(60));

    try {
      const result = await parser.parse(url);

      console.log('\n📊 Results:');
      console.log(`  ✅ Name: ${result.name ? result.name.substring(0, 50) : '❌ Not found'}`);
      console.log(`  ✅ Price: ${result.price || '❌ Not found'}`);
      console.log(`  ✅ Brand: ${result.brand || '❌ Not found'}`);
      console.log(`  ✅ Images: ${result.images?.length || 0} found`);
      console.log(`  📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);

      if (result.images?.length > 0) {
        console.log(`  🖼  First image: ${result.images[0].substring(0, 60)}...`);
      }

      if (result.error) {
        console.log(`  ⚠️  Error: ${result.error}`);
      }

    } catch (error) {
      console.log(`  ❌ Parse failed: ${error.message}`);
      console.log(`     Stack: ${error.stack?.split('\n')[1]}`);
    }

    console.log('-'.repeat(60));

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Debug test complete\n');
}

debugParser().catch(console.error);