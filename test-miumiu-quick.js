const { scrapeMiuMiuWithPuppeteer } = require('./scrapers/miumiu-puppeteer');

const testUrl = 'https://www.miumiu.com/it/en/p/black-denim-patchwork-blouson-jacket/GWB284_1778_F0002_S_OOO';

async function testQuick() {
  console.log('Testing Miu Miu image deduplication...\n');

  try {
    const result = await scrapeMiuMiuWithPuppeteer(testUrl);

    if (result.success) {
      console.log('✅ Success!');
      console.log('Images found:', result.product.images?.length || 0);
      console.log('\nImage URLs:');
      result.product.images?.forEach((url, i) => {
        // Extract the view type from URL
        const viewMatch = url.match(/_([A-Z]{3})\./);
        const view = viewMatch ? viewMatch[1] : 'Unknown';
        console.log(`${i + 1}. View: ${view} - ${url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('/') + 50)}`);
      });
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

testQuick();