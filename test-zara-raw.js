const { scrapeZara } = require('./scrapers/zara');

const testUrl = "https://www.zara.com/us/en/fitted-knit-jacket-p05536126.html";

scrapeZara(testUrl)
  .then(result => {
    console.log('Raw result from scraper:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
  });