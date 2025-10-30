const UniversalParserV3 = require('./universal-parser-v3');

async function testShipsParser() {
  const parser = new UniversalParserV3();
  const url = 'https://www.shipsltd.co.jp/pages/sp_50th_anniversary_items.aspx#modal-60';

  console.log('🔍 Testing SHIPS URL with V3 parser...\n');

  try {
    const result = await parser.parse(url);

    console.log('📊 Parse Result:');
    console.log('  Name:', result.name);
    console.log('  Brand:', result.brand);
    console.log('  Price:', result.price);
    console.log('  Currency:', result.currency);
    console.log('  Image count:', result.images?.length || 0);
    console.log('  Confidence:', result.confidence);
    console.log('  Error:', result.error);

    if (result.images && result.images.length > 0) {
      console.log('\n📸 Images:');
      result.images.slice(0, 5).forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img.substring(0, 100)}`);
      });
    }

    console.log('\n🔍 Full result keys:', Object.keys(result));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await parser.cleanup();
  }
}

testShipsParser();
