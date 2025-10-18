const { scrapeBoden } = require('./scrapers/boden');

async function testBoden() {
  const url = 'https://us.boden.com/products/helen-cord-kilt-skirt-navy?_pos=34&_fid=ca7aeaf79&_ss=c';

  console.log('Testing Boden parser with:', url);

  try {
    const result = await scrapeBoden(url);
    console.log('\n📦 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBoden();