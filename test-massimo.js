require('dotenv').config();
const { scrapeWithApifyPuppeteer } = require('./scrapers/apify-puppeteer');

async function testMassimoDutti() {
  const url = 'https://www.massimodutti.com/us/linen-blend-straight-leg-trousers-l05037788';
  
  console.log('Testing Massimo Dutti scraper with Apify...');
  console.log('API Token exists:', !!process.env.APIFY_API_TOKEN);
  
  try {
    const result = await scrapeWithApifyPuppeteer(url, 'Massimo Dutti');
    console.log('\n✅ Apify Result:');
    console.log('Name:', result.name || result.title || 'Not found');
    console.log('Price:', result.price || 'Not found');
    console.log('Brand:', result.brand || 'Not found');
    console.log('Images found:', result.images ? result.images.length : 0);
    if (result.images && result.images.length > 0) {
      console.log('First image:', result.images[0]);
    }
    console.log('\nFull result structure:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testMassimoDutti();