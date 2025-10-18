const UniversalParserV3 = require('./universal-parser-v3');

async function testDirectParser() {
  console.log('🧪 Testing Universal Parser V3 directly...');

  const parser = new UniversalParserV3();

  // Wait a moment for the pattern loading to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/';

  console.log('📍 Testing URL:', url);
  console.log('🔧 Available patterns for 69mcfly.com:', parser.sitePatterns['69mcfly.com']);

  try {
    const result = await parser.parse(url);

    console.log('\n✅ Parse result:');
    console.log('Product name:', result.product_name || result.name);
    console.log('Price:', result.sale_price || result.price);
    console.log('Images found:', result.image_urls?.length || result.images?.length || 0);
    console.log('Brand:', result.brand);
    console.log('Confidence:', result.confidence);

    if (result.image_urls?.length > 0) {
      console.log('\n🖼️ Images:');
      result.image_urls.forEach((img, i) => {
        console.log(`${i + 1}. ${img}`);
      });
    } else if (result.images?.length > 0) {
      console.log('\n🖼️ Images:');
      result.images.forEach((img, i) => {
        console.log(`${i + 1}. ${img}`);
      });
    } else {
      console.log('\n❌ No images found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectParser();