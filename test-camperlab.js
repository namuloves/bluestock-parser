const scrapeCamperlab = require('./scrapers/camperlab');

const testUrls = [
  // Product detail pages
  'https://www.camperlab.com/en_US/men/shoes/tormenta/camperlab-tormenta-K100885-001',
  'https://www.camperlab.com/en_US/women/shoes/vamonos/camperlab-vamonos-K201501-001',
  
  // Listing pages
  'https://www.camperlab.com/en_US/men/shoes',
  'https://www.camperlab.com/en_US/women/shoes'
];

async function testCamperlab() {
  console.log('\n🧪 Testing Camperlab scraper...\n');
  
  for (const url of testUrls) {
    console.log('\n' + '='.repeat(80));
    console.log(`Testing URL: ${url}`);
    console.log('='.repeat(80));
    
    try {
      const result = await scrapeCamperlab(url);
      
      if (result.products) {
        // Listing page result
        console.log('\n✅ Listing page scraped successfully!');
        console.log(`Total products found: ${result.totalProducts}`);
        console.log('\nFirst 3 products:');
        result.products.slice(0, 3).forEach((product, index) => {
          console.log(`\n${index + 1}. ${product.name || 'No name'}`);
          console.log(`   Price: $${product.price || 'N/A'}`);
          console.log(`   URL: ${product.url || 'N/A'}`);
          console.log(`   Image: ${product.image ? '✓' : '✗'}`);
        });
      } else {
        // Product page result
        console.log('\n✅ Product page scraped successfully!');
        console.log('\nProduct Details:');
        console.log(`Name: ${result.name || 'Not found'}`);
        console.log(`Brand: ${result.brand || 'Not found'}`);
        console.log(`Price: $${result.price || 'Not found'}`);
        console.log(`Original Price: $${result.originalPrice || 'Same as current price'}`);
        console.log(`SKU: ${result.sku || 'Not found'}`);
        console.log(`In Stock: ${result.inStock ? 'Yes' : 'No'}`);
        console.log(`Images: ${result.images?.length || 0} found`);
        console.log(`Sizes Available: ${result.sizes?.join(', ') || 'None found'}`);
        console.log(`Colors: ${result.colors?.join(', ') || 'None found'}`);
        console.log(`Description: ${result.description ? result.description.substring(0, 100) + '...' : 'Not found'}`);
        
        if (result.images && result.images.length > 0) {
          console.log(`\nFirst image URL: ${result.images[0]}`);
        }
      }
    } catch (error) {
      console.error(`\n❌ Error scraping ${url}:`);
      console.error(error.message);
      if (error.response) {
        console.error(`HTTP Status: ${error.response.status}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 Camperlab scraper test completed!');
  console.log('='.repeat(80) + '\n');
}

// Run the test
testCamperlab().catch(error => {
  console.error('\n❌ Fatal error during test:');
  console.error(error);
  process.exit(1);
});