const { scrapeZara } = require('./scrapers/zara');

const testUrl = 'https://www.zara.com/us/en/zw-collection-lace-camisole-top-p05919105.html?v1=462615212&v2=2491343';

console.log('🧪 Testing Zara scraper with real URL...\n');

scrapeZara(testUrl).then(result => {
  console.log('📦 Scraped Product Data:');
  console.log('=======================');
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('❌ Test failed:', error);
});