const UniversalParser = require('./universal-parser');

async function testFixedImages() {
  console.log('🧪 Testing Fixed Image Extraction\n');

  const parser = new UniversalParser();

  const testUrls = [
    {
      name: 'Boden',
      url: 'https://us.boden.com/products/helen-cord-kilt-skirt-navy'
    },
    {
      name: 'Nordstrom',
      url: 'https://www.nordstrom.com/s/free-people-we-the-free-palmer-cuffed-jeans-aged-indigo/7766074'
    }
  ];

  for (const test of testUrls) {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log('─'.repeat(50));

    try {
      const result = await parser.parse(test.url);

      console.log(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`Name: ${result.name || '(not found)'}`);
      console.log(`Price: ${result.price || '(not found)'}`);
      console.log(`Images: ${result.images?.length || 0} found`);

      if (result.images && result.images.length > 0) {
        console.log('\n📸 First 3 images:');
        result.images.slice(0, 3).forEach((img, i) => {
          console.log(`  ${i + 1}. ${img}`);
        });
      } else {
        console.log('❌ No images found');
      }

      console.log(`\nImage source: ${result.images_source || 'none'}`);

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

testFixedImages().catch(console.error);