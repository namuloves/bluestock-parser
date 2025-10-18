const { scrapeFWRD } = require('./scrapers/fwrd');

// Test with clean URL (no query params)
const cleanUrl = "https://www.fwrd.com/product-samuel-zelig-yearbook-pant-in-khaki/SLZF-MP7/";

console.log('Testing clean FWRD URL:', cleanUrl);
console.log('---');

scrapeFWRD(cleanUrl)
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\nError:', error);
  });