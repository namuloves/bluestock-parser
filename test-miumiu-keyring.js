const { scrapeMiuMiuWithPuppeteer } = require('./scrapers/miumiu-puppeteer');

async function testMiuMiuKeyring() {
  const url = 'https://www.miumiu.com/us/en/p/leather-keyring-trick/5TL578_2IE1_F0016';

  console.log('=== Testing Miu Miu Keyring ($650 product) ===');
  console.log('URL:', url);
  console.log('Expected price: $650');
  console.log('');

  const result = await scrapeMiuMiuWithPuppeteer(url);

  if (result.success) {
    console.log('✅ Successfully scraped product:');
    console.log('Name:', result.product.name);
    console.log('Price:', result.product.price);
    console.log('SKU:', result.product.sku);

    // Check if price is correct
    if (result.product.price) {
      const priceNumbers = result.product.price.match(/[\d,]+(?:\.\d+)?/);
      if (priceNumbers) {
        const numericPrice = parseFloat(priceNumbers[0].replace(',', ''));
        if (numericPrice === 650) {
          console.log('✅ CORRECT: Price matches expected $650');
        } else if (numericPrice === 1200 || numericPrice === 1220) {
          console.log('❌ ERROR: Getting wrong price! Expected $650 but got', numericPrice);
        } else {
          console.log('⚠️  Price extracted:', numericPrice);
        }
      }
    }
  } else {
    console.log('❌ Failed to scrape product');
    console.log('Error:', result.error);
  }
}

testMiuMiuKeyring().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});