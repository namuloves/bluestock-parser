const UniversalParserV3 = require('./universal-parser-v3');

async function testBespokePostCache() {
  const parser = new UniversalParserV3();
  parser.logLevel = 'verbose'; // Enable verbose logging

  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('🧪 Testing Bespoke Post cache extraction...\n');

  const result = await parser.parse(url);

  console.log('\n📦 RESULT:');
  console.log('Name:', result?.name);
  console.log('Brand:', result?.brand);
  console.log('Price:', result?.price);
  console.log('Description:', result?.description?.substring(0, 200));
  console.log('Images:', result?.images?.length);

  console.log('\n🔍 Name Analysis:');
  console.log('- Has "| Bespoke Post"?', result?.name?.includes('| Bespoke Post'));
  console.log('- Should be:', 'Dark Energy Spectre Solar Panel');
  console.log('- Currently is:', result?.name);

  await parser.cleanup();
}

testBespokePostCache().catch(console.error);
