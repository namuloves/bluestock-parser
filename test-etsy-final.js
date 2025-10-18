// Set environment variables
process.env.USE_PROXY = 'true';
process.env.DECODO_USERNAME = 'spubcuhdc9';
process.env.DECODO_PASSWORD = 'nTDf2hlhI96r=eaNk4';

const { scrapeEtsy } = require('./scrapers/etsy');

const testUrl = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';

console.log('🧪 Final Etsy scraper test...\n');

scrapeEtsy(testUrl).then(result => {
  console.log('📦 Scraped Product Data:');
  console.log('=======================');
  console.log('Name:', result.name);
  console.log('Price:', result.price);
  console.log('Brand/Shop:', result.brand);
  console.log('Images:', result.images?.length || 0, 'images');
  console.log('In Stock:', result.inStock);
  console.log('\nFull data:');
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('❌ Test failed:', error);
});