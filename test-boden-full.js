const { scrapeProduct } = require('./scrapers/index');

async function testBodenFull() {
  const url = 'https://us.boden.com/products/helen-cord-kilt-skirt-navy?_pos=34&_fid=ca7aeaf79&_ss=c';

  console.log('Testing Boden parser through main scraper with:', url);

  try {
    const result = await scrapeProduct(url);
    console.log('\n📦 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBodenFull();