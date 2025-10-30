const UniversalParserV3 = require('./universal-parser-v3');

async function testBespokePost() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/line-of-trade-x-harley-of-scotland-shetland-crew?rl=image';

  console.log('Testing URL:', url);
  console.log('---');

  const result = await parser.parse(url);

  console.log('\n📋 RESULT:');
  console.log(JSON.stringify(result, null, 2));

  // Also check the priceText field to see what was extracted
  console.log('\n💰 Price debugging:');
  console.log('- Extracted price:', result.price);
  console.log('- Price text:', result.priceText);
  console.log('- Currency:', result.currency);

  await parser.cleanup();
}

testBespokePost().catch(console.error);
