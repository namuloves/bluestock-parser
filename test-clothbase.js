const { scrapeProduct } = require('./scrapers/index');

const testUrl = 'https://clothbase.com/items/3e27e933_cecilie-bahnsen-green-jeanne-midi-dress_cecilie-bahnsen';

async function testClothbaseScraper() {
  console.log('🧪 Testing Clothbase scraper...\n');
  console.log('URL:', testUrl);
  console.log('=' .repeat(80));
  
  try {
    const result = await scrapeProduct(testUrl);
    
    if (result.success) {
      console.log('\n✅ SUCCESS - Product scraped successfully!\n');
      console.log('Product Details:');
      console.log('-'.repeat(40));
      console.log('Name:', result.product.name || result.product.product_name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.price || `$${result.product.sale_price}`);
      console.log('Original Price:', result.product.originalPrice || `$${result.product.original_price}`);
      console.log('Currency:', result.product.currency);
      console.log('Condition:', result.product.condition);
      console.log('Size:', result.product.sizes);
      console.log('Color:', result.product.colors);
      console.log('Material:', result.product.material);
      console.log('Category:', result.product.category);
      console.log('Images:', result.product.images?.length || 0, 'images found');
      if (result.product.images?.length > 0) {
        console.log('  - First image:', result.product.images[0]);
      }
      console.log('Measurements:', result.product.measurements);
      console.log('\nDescription:', result.product.description?.substring(0, 200) + '...');
    } else {
      console.log('\n❌ FAILED - Error scraping product');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testClothbaseScraper();