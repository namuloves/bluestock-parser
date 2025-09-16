const { scrapeProduct } = require('./scrapers/index');

const testUrl = 'https://www.fwrd.com/product-marni-round-neck-striped-sweater-in-winter-wheat/MARN-MK63/?d=Mens&utm_campaign=pinterest_performance_catalogsales&utm_medium=paidsocial&utm_source=pinterestpaid&utm_content=Pinterest+Performance%2B+Prospecting&pp=0&epik=dj0yJnU9Q2F1a3liR3YzcmVjbHdfM3dIUlAyN3BXN0p2WjNhclQmcD0xJm49dENjNTRSWmxtRU9qVk5IamNOMEdKUSZ0PUFBQUFBR2pJOXpB';

async function testFWRD() {
  console.log('\n🧪 Testing FWRD with current scraper...\n');

  try {
    const result = await scrapeProduct(testUrl);

    if (result.success) {
      console.log('✅ Product scraped successfully!');
      console.log('\nProduct Details:');
      console.log('Name:', result.product.product_name || 'Not found');
      console.log('Brand:', result.product.brand || 'Not found');
      console.log('Price:', result.product.sale_price || 'Not found');
      console.log('Images found:', result.product.image_urls?.length || 0);

      if (result.product.image_urls && result.product.image_urls.length > 0) {
        console.log('\nImage URLs:');
        result.product.image_urls.forEach((url, i) => {
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

testFWRD().catch(console.error);