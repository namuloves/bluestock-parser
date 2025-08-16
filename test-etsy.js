const { scrapeEtsy } = require('./scrapers/etsy');

const testUrl = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';

console.log('🧪 Testing Etsy scraper...\n');

scrapeEtsy(testUrl).then(result => {
  console.log('📦 Scraped Product Data:');
  console.log('=======================');
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('❌ Test failed:', error);
});