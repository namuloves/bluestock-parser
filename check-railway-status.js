const axios = require('axios');

async function checkRailwayStatus() {
  const railwayUrl = 'https://bluestock-parser.up.railway.app';

  console.log('🚂 Checking Railway Deployment Status...\n');

  try {
    // First check if service is running
    const testResponse = await axios.get(`${railwayUrl}/test`, { timeout: 5000 });
    console.log('✅ Service is running');
    console.log('Parser Version:', testResponse.data.parserVersion);
    console.log('---\n');

    // Now test Aritzia scraping
    console.log('Testing Aritzia scraping...');
    const scrapeResponse = await axios.post(`${railwayUrl}/scrape`, {
      url: 'https://www.aritzia.com/us/en/product/homestretch-rib-crew-longsleeve/102669.html'
    }, {
      timeout: 30000,
      validateStatus: () => true
    });

    console.log('Response status:', scrapeResponse.status);
    console.log('Response keys:', Object.keys(scrapeResponse.data));

    // Check for new fields from our fixes
    if (scrapeResponse.data.userMessage) {
      console.log('✅ NEW CODE DEPLOYED - userMessage field found');
      console.log('User message:', scrapeResponse.data.userMessage);
    } else {
      console.log('❌ OLD CODE STILL RUNNING - no userMessage field');
    }

    if (scrapeResponse.data.technicalError) {
      console.log('Technical error:', scrapeResponse.data.technicalError);
    }

    if (scrapeResponse.data.success) {
      console.log('✅ Scraping succeeded');
      console.log('Product:', scrapeResponse.data.product?.product_name);
    } else {
      console.log('❌ Scraping failed');
      console.log('Error:', scrapeResponse.data.error);
    }

    // Check server.js for our changes
    console.log('\n📝 Checking for code changes indicators:');

    // The old code would return different error messages
    const errorMessage = scrapeResponse.data.error || '';
    if (errorMessage.includes('No scraper available for this site')) {
      console.log('❌ This is the OLD error message from scrapers/index.js');
      console.log('   The Aritzia scraper is still active (not commented out)');
    } else if (errorMessage.includes('Request failed with status code 403')) {
      console.log('❌ This is the OLD raw error message');
      console.log('   User-friendly error handling is NOT active');
    } else if (errorMessage.includes('has blocked our scraper')) {
      console.log('✅ This is the NEW user-friendly error message');
      console.log('   Your fixes ARE deployed!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRailwayStatus();