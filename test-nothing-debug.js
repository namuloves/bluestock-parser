const UniversalParserV3 = require('./universal-parser-v3');

async function testNothing() {
  const parser = new UniversalParserV3();
  const url = 'https://us.nothing.tech/products/cmf-headphone-pro?Colour=Dark+Grey';

  console.log('🔍 Testing Nothing.tech URL with V3 parser...\n');

  try {
    const result = await parser.parse(url);

    console.log('📊 Parse Result:');
    console.log('  Name:', result.name);
    console.log('  Brand:', result.brand);
    console.log('  Price:', result.price);
    console.log('  Image count:', result.images?.length || 0);
    console.log('  Confidence:', result.confidence);
    console.log('\n📸 Images:');
    (result.images || []).forEach((img, idx) => {
      console.log(`  ${idx + 1}. ${img.substring(0, 100)}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await parser.cleanup();
  }
}

testNothing();
