const { scrapeZara } = require('./scrapers/zara');

const testUrl = "https://www.zara.com/us/en/fitted-knit-jacket-p05536126.html";

console.log('Testing Zara image ordering...');
console.log('URL:', testUrl);
console.log('---');

scrapeZara(testUrl)
  .then(result => {
    console.log('\nProduct:', result.name);
    console.log('Total images:', result.images?.length || 0);
    console.log('\nFirst 3 images:');
    if (result.images) {
      result.images.slice(0, 3).forEach((img, i) => {
        console.log(`${i + 1}. ${img}`);
      });
    }
  })
  .catch(error => {
    console.error('\nError:', error);
  });