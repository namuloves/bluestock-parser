const UniversalParserV3 = require('./universal-parser-v3');

async function test() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('✅ FINAL TEST - Bespoke Post Solar Panel\n');
  console.log('URL:', url);
  console.log('---\n');

  const result = await parser.parse(url);

  console.log('📦 PARSED PRODUCT:');
  console.log('✅ Name:', result?.name);
  console.log('✅ Brand:', result?.brand);
  console.log('✅ Price: $' + result?.price, result?.currency || 'USD');
  console.log('✅ Images:', result?.images?.length, 'images');
  console.log('✅ Description:', result?.description);
  console.log('\n🔍 VERIFICATION:');
  console.log('- Name has NO suffix:', !result?.name?.includes('| Bespoke Post') ? '✅ PASS' : '❌ FAIL');
  console.log('- Has valid price:', result?.price === 230 ? '✅ PASS' : '❌ FAIL');
  console.log('- Has brand:', result?.brand === 'Dark Energy' ? '✅ PASS' : '❌ FAIL');
  console.log('- Has multiple images:', result?.images?.length > 1 ? '✅ PASS' : '❌ FAIL');
  console.log('- Has description:', !!result?.description ? '✅ PASS' : '❌ FAIL');

  await parser.cleanup();
}

test().catch(err => {
  console.error('❌ ERROR:', err.message);
  process.exit(1);
});
