const { scrapeOctobreEditions } = require('./scrapers/octobre-editions');

const url = 'https://www.octobre-editions.com/us-en/product/sezane/kais-coat/blue-grey#size-2';

async function test() {
  console.log('Testing new Octobre Editions scraper:', url);
  console.log('━'.repeat(60));

  try {
    const result = await scrapeOctobreEditions(url);

    console.log('\n✅ SCRAPER RESULT:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n📊 PRODUCT SUMMARY:');
      console.log('Name:', result.product.product_name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.price, result.product.currency);
      console.log('Images:', result.product.images?.length || 0);
      console.log('Description:', result.product.description?.substring(0, 100));
    } else {
      console.log('\n❌ SCRAPING FAILED:', result.error);
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }

  // Cleanup
  const { cleanup } = require('./scrapers/octobre-editions');
  await cleanup();

  process.exit(0);
}

test();
