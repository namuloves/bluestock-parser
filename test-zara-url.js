const { scrapeZara } = require('./scrapers/zara');

const testUrl = "https://www.zara.com/us/en/fitted-knit-jacket-p05536126.html?v1=459384711&v2=2491343";

console.log('Testing Zara URL:', testUrl);
console.log('---');

scrapeZara(testUrl)
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\nError:', error);
  });