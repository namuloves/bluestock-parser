const { scrapeFWRD } = require('./scrapers/fwrd');

const testUrl = "https://www.fwrd.com/product-samuel-zelig-yearbook-pant-in-khaki/SLZF-MP7/?d=Mens&utm_campaign=pinterest_performance_catalogsales&utm_medium=paidsocial&utm_source=pinterestpaid&utm_content=Pinterest+Performance%2B+Prospecting&pp=0&epik=dj0yJnU9YzlNUmVqb3dNaWp3S3RXNTR0Y29uT0pOSHU0NWhOTDYmcD0xJm45QV9wNU5IWlMzNVVlN1RkRGdzYVBmdyZ0PUFBQUFBR2pPNHg4";

console.log('Testing FWRD URL:', testUrl);
console.log('---');

scrapeFWRD(testUrl)
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\nError:', error);
  });