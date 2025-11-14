require('dotenv').config();
const { scrapeSsense } = require('./scrapers/ssense');

async function testPuppeteer() {
  const url = 'https://www.ssense.com/en-us/women/product/issey-miyake/purple-chiffon-twist-top/18498641';

  console.log('🧪 Testing SSENSE Puppeteer scraper (ssense.js)...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    const startTime = Date.now();
    const product = await scrapeSsense(url);
    const duration = Date.now() - startTime;

    console.log('\n✅ SUCCESS! Puppeteer method works!');
    console.log('Duration:', duration + 'ms');
    console.log('\n📊 Product Data:');
    console.log('  Name:', product.name);
    console.log('  Brand:', product.brand);
    console.log('  Price:', product.price, product.currency);
    console.log('  Images:', product.images.length);
    console.log('  Sizes:', product.sizes.length);
    console.log('  Description length:', product.description?.length || 0);
    console.log('  In Stock:', product.inStock);

    console.log('\n🖼️  Image URLs:');
    product.images.slice(0, 3).forEach((img, i) => {
      console.log(`  ${i + 1}. ${img}`);
    });
    if (product.images.length > 3) {
      console.log(`  ... and ${product.images.length - 3} more`);
    }

    console.log('\n👕 Sizes:', product.sizes.join(', '));

  } catch (error) {
    console.error('\n❌ FAILED! Puppeteer method not working');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPuppeteer();
