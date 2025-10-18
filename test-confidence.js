const UniversalParser = require('./universal-parser');

async function testConfidence() {
  console.log('🔬 Testing Universal Parser Confidence Scoring\n' + '='.repeat(60));

  const parser = new UniversalParser();

  const testUrls = [
    'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html',
    'https://www.nike.com/t/dunk-low-retro-mens-shoes-76KnBL/DD1391-100'
  ];

  for (const url of testUrls) {
    console.log(`\nTesting: ${url}`);
    try {
      const result = await parser.parse(url);

      console.log('📊 Confidence Score:', result.confidence || 0);
      console.log('📋 Fields Found:');
      console.log('   Name:', result.name ? `✅ "${result.name}"` : '❌');
      console.log('   Price:', result.price ? `✅ $${result.price}` : '❌');
      console.log('   Brand:', result.brand ? `✅ ${result.brand}` : '❌');
      console.log('   Images:', result.images?.length ? `✅ ${result.images.length} images` : '❌');
      console.log('   Description:', result.description ? '✅' : '❌');

      console.log('🔍 Data Sources:');
      console.log('   Name from:', result.name_source || 'none');
      console.log('   Price from:', result.price_source || 'none');
      console.log('   Images from:', result.images_source || 'none');

    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
}

testConfidence().catch(console.error);