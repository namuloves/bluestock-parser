const UniversalParserV3 = require('./universal-parser-v3');

async function test() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('🔍 Testing Bespoke Post image URLs...\n');

  const result = await parser.parse(url);

  console.log('📦 RESULT:');
  console.log('Name:', result?.name);
  console.log('Images found:', result?.images?.length);

  console.log('\n🖼️ IMAGE URLs:');
  result?.images?.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img}`);

    // Check if it's a valid image URL
    if (img.includes('dark-energy')) {
      console.log('   ✅ Contains product reference');
    } else {
      console.log('   ⚠️ May not be a product image');
    }
  });

  await parser.cleanup();
}

test().catch(console.error);