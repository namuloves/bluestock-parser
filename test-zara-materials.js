const { scrapeZara } = require('./scrapers/zara');

const testUrl = "https://www.zara.com/us/en/fitted-knit-jacket-p05536126.html";

console.log('Testing Zara materials and colors extraction...');
console.log('URL:', testUrl);
console.log('---');

scrapeZara(testUrl)
  .then(result => {
    console.log('\nProduct:', result.name);
    console.log('Price:', result.price);
    console.log('\nColors:', result.colors?.join(', ') || 'None found');
    console.log('\nMaterials:', result.materials?.join(', ') || 'None found');
    console.log('\nFirst image:', result.images?.[0] || 'No images');
  })
  .catch(error => {
    console.error('\nError:', error);
  });