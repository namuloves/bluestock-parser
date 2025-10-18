const { scrapeMiuMiuWithPuppeteer } = require('./scrapers/miumiu-puppeteer');

const testUrl = 'https://www.miumiu.com/it/en/p/black-denim-patchwork-blouson-jacket/GWB284_1778_F0002_S_OOO';

async function testMiuMiuPuppeteer() {
  console.log('\n🧪 Testing Miu Miu with Puppeteer scraper...\n');

  try {
    const result = await scrapeMiuMiuWithPuppeteer(testUrl);

    if (result.success) {
      console.log('✅ Product scraped successfully!');
      console.log('\nProduct Details:');
      console.log('Name:', result.product.name || 'Not found');
      console.log('Brand:', result.product.brand || 'Not found');
      console.log('Price:', result.product.price || 'Not found');
      console.log('SKU:', result.product.sku || 'Not found');
      console.log('Description:', result.product.description ? result.product.description.substring(0, 100) + '...' : 'Not found');
      console.log('Sizes:', result.product.sizes?.join(', ') || 'Not found');
      console.log('Material:', result.product.material || 'Not found');
      console.log('Images found:', result.product.images?.length || 0);

      if (result.product.images && result.product.images.length > 0) {
        console.log('\nAll image URLs:');
        result.product.images.forEach((url, i) => {
          console.log(`${i + 1}. ${url}`);
        });
      }
    } else {
      console.log('❌ Failed to scrape product');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMiuMiuPuppeteer().catch(console.error);