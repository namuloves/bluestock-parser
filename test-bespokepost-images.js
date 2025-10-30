const UniversalParserV3 = require('./universal-parser-v3');

async function testBespokePost() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/line-of-trade-x-harley-of-scotland-shetland-crew?rl=image';

  console.log('Testing URL:', url);
  console.log('---');

  const result = await parser.parse(url);

  console.log('\n📸 Images:');
  console.log('Total images:', result.images?.length || 0);
  if (result.images) {
    result.images.forEach((img, i) => {
      console.log(`${i + 1}. ${img}`);
    });
  }

  await parser.cleanup();
}

testBespokePost().catch(console.error);
