const { scrapeProduct } = require('./scrapers/index');

const testUrl = 'https://www.fwrd.com/product-bode-spirit-sweater-in-blue/BOFE-MK12/?d=Mens&utm_campaign=pinterest_performance_catalogsales&utm_medium=paidsocial&';

async function testFWRD() {
  console.log('\n🧪 Testing FWRD with URL:', testUrl, '\n');

  try {
    const result = await scrapeProduct(testUrl);

    if (result.success) {
      console.log('✅ Product scraped successfully!');
      console.log('\nProduct Details:');
      console.log('Name:', result.product.product_name || 'Not found');
      console.log('Brand:', result.product.brand || 'Not found');
      console.log('Price:', result.product.sale_price || 'Not found');
      console.log('Original Price:', result.product.original_price || 'Not found');
      console.log('Description:', result.product.description ? result.product.description.substring(0, 100) + '...' : 'Not found');
      console.log('Images found:', result.product.image_urls?.length || 0);
      console.log('Sizes:', result.product.sizes?.join(', ') || 'Not found');
      console.log('Colors:', result.product.colors?.join(', ') || 'Not found');

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
    console.error('Stack:', error.stack);
  }
}

testFWRD().catch(console.error);
