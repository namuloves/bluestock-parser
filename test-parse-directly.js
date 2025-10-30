const UniversalParserV3 = require('./universal-parser-v3');

async function testParseDirect() {
  const parser = new UniversalParserV3();
  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  console.log('Testing parse...');

  try {
    const result = await parser.parse(url);
    console.log('✅ Parse successful');
    console.log('Images:', result?.images);
  } catch (error) {
    console.error('❌ Parse failed:', error.message);
    console.error('Stack:', error.stack);
  }

  await parser.cleanup();
}

testParseDirect().catch(console.error);