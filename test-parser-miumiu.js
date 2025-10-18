const UniversalParserV3 = require('./universal-parser-v3');

async function testMiumiuParser() {
  const parser = new UniversalParserV3();
  const url = 'https://www.miumiu.com/us/en/p/new-balance-x-miu-miu-530-sl-suede-and-mesh-sneakers/5E165E_3D8C_F0009_F_BD05';

  console.log('Testing Universal Parser V3 with Miu Miu...\n');

  try {
    const result = await parser.parse(url);
    console.log('Results:');
    console.log('  Name:', result.name || 'Not found');
    console.log('  Price:', result.price || 'Not found');
    console.log('  Brand:', result.brand || 'Not found'); 
    console.log('  Confidence:', result.confidence);
    console.log('  Images:', result.images?.length || 0);

    if (!result.price) {
      console.log('\n⚠️ Price not extracted!');
      console.log('Debugging: Check if JSON-LD extraction is working');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  await parser.cleanup();
}

testMiumiuParser();
