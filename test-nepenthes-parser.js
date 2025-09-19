const UniversalParser = require('./universal-parser');

async function testNepenthesParser() {
  const url = 'https://nepenthesny.com/products/rhodolirion-watch-cap-with-bow-black';

  console.log('🧪 Testing Universal Parser on Nepenthes NY\n');
  console.log('URL:', url);
  console.log('═'.repeat(60));

  const parser = new UniversalParser();

  try {
    const result = await parser.parse(url);

    console.log('\n📊 Results:');
    console.log('Confidence:', (result.confidence * 100).toFixed(0) + '%');
    console.log('\n✅ Extracted Data:');
    console.log('  Name:', result.name || '❌ NOT FOUND');
    console.log('  Price:', result.price || '❌ NOT FOUND');
    console.log('  Brand:', result.brand || '❌ NOT FOUND');
    console.log('  SKU:', result.sku || '❌ NOT FOUND');
    console.log('  Images:', result.images?.length || 0, 'found');
    console.log('  Description:', result.description ? result.description.substring(0, 50) + '...' : '❌ NOT FOUND');

    console.log('\n📋 Data Sources:');
    console.log('  Name from:', result.name_source || 'none');
    console.log('  Price from:', result.price_source || 'none');
    console.log('  Brand from:', result.brand_source || 'none');

    if (result.images && result.images.length > 0) {
      console.log('\n🖼️ Images:');
      result.images.forEach((img, i) => {
        console.log(`  ${i + 1}. ${img}`);
      });
    }

    console.log('\n🔍 Raw Result (for debugging):');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testNepenthesParser();