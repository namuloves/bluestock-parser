const { scrapePoshmark } = require('./scrapers/poshmark');

const testUrl = 'https://poshmark.com/listing/L-academie-Marianna-Enoa-Midi-Dress-in-Red-Light-Pink-689def60c71ba137f903554a';

console.log('🧪 Testing Poshmark scraper...\n');

scrapePoshmark(testUrl).then(result => {
  console.log('📦 Scraped Product Data:');
  console.log('=======================');
  console.log(JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('❌ Test failed:', error);
});