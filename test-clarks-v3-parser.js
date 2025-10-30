const UniversalParserV3 = require('./universal-parser-v3');

async function testClarks() {
  const parser = new UniversalParserV3();
  const url = 'https://www.clarks.com/en-us/wallabee/26182834-p';

  console.log('🔍 Testing Clarks URL with V3 parser...\n');

  try {
    const result = await parser.parse(url);

    console.log('📊 Parse Result:');
    console.log('  Name:', result.name);
    console.log('  Brand:', result.brand);
    console.log('  Price:', result.price);
    console.log('  Currency:', result.currency);
    console.log('  Image count:', result.images?.length || 0);
    console.log('  Confidence:', result.confidence);
    console.log('\n📸 Images:');
    (result.images || []).forEach((img, idx) => {
      console.log(`  ${idx + 1}. ${img}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await parser.cleanup();
  }
}

testClarks();
