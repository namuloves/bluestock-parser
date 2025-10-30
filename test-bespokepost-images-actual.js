const UniversalParserV3 = require('./universal-parser-v3');

async function testImages() {
  const parser = new UniversalParserV3();
  parser.logLevel = 'verbose';

  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('🧪 Testing Bespoke Post image extraction...\n');

  const result = await parser.parse(url);

  console.log('📦 IMAGES FOUND:', result?.images?.length);
  console.log('\n🖼️ All images:');
  result?.images?.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img}`);
  });

  await parser.cleanup();
}

testImages().catch(console.error);
