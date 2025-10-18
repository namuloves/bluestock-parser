const UniversalParserV3 = require('./universal-parser-v3');
const parser = new UniversalParserV3();

async function test() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/';
  console.log('Testing Universal Parser V3 for 69mcfly...\n');

  try {
    const result = await parser.parse(url);
    console.log('Success:', !!result);
    console.log('Name:', result.name);
    console.log('Price:', result.price);
    console.log('Brand:', result.brand);
    console.log('Images:', result.images?.length || 0);
    console.log('Confidence:', result.confidence);
    if (result.images?.length > 0) {
      console.log('\nFirst 3 images:');
      result.images.slice(0, 3).forEach((img, i) => console.log(`  ${i+1}. ${img}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await parser.close();
  }
}

test();
