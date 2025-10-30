const UniversalParserV3 = require('./universal-parser-v3');

async function testAirelles() {
  const parser = new UniversalParserV3();
  parser.logLevel = 'verbose';

  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  console.log('🔍 Testing Airelles product...\n');

  const result = await parser.parse(url);

  console.log('\n📦 RESULT:');
  console.log('Name:', result?.name);
  console.log('Price:', result?.price);
  console.log('Total images:', result?.images?.length);

  console.log('\n🖼️ All images:');
  result?.images?.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img}`);
  });

  // Check for duplicates
  const seen = new Set();
  const duplicates = [];
  result?.images?.forEach((img, i) => {
    if (seen.has(img)) {
      duplicates.push({ index: i + 1, url: img });
    }
    seen.add(img);
  });

  if (duplicates.length > 0) {
    console.log('\n⚠️ DUPLICATES FOUND:');
    duplicates.forEach(dup => {
      console.log(`   Position ${dup.index}: ${dup.url}`);
    });
  } else {
    console.log('\n✅ No duplicates found');
  }

  await parser.cleanup();
}

testAirelles().catch(console.error);
