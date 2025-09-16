const { scrapeProduct } = require('./scrapers/index');

const testUrl = 'https://www.miumiu.com/it/en/p/black-denim-patchwork-blouson-jacket/GWB284_1778_F0002_S_OOO';

async function testMiuMiu() {
  console.log('\n🧪 Testing Miu Miu with current scraper...\n');

  try {
    const result = await scrapeProduct(testUrl);

    if (result.success) {
      console.log('✅ Product scraped successfully!');
      console.log('\nProduct Details:');
      console.log('Name:', result.product.product_name || 'Not found');
      console.log('Brand:', result.product.brand || 'Not found');
      console.log('Price:', result.product.sale_price || 'Not found');
      console.log('SKU:', result.product.sku || 'Not found');
      console.log('Description:', result.product.description ? result.product.description.substring(0, 100) + '...' : 'Not found');
      console.log('Images found:', result.product.image_urls?.length || 0);

      if (result.product.image_urls && result.product.image_urls.length > 0) {
        console.log('\nFirst 3 image URLs:');
        result.product.image_urls.slice(0, 3).forEach((url, i) => {
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

testMiuMiu().catch(console.error);