const { scrapeSaksFifthAvenue } = require('./scrapers/saksfifthavenue');

async function test() {
  // Test with a different product that might have more description
  const testUrl = 'https://www.saksfifthavenue.com/product/alice-olivia-hayes-blazer-0400020133244.html';
  
  console.log('🧪 Testing Saks scraper with different product...');
  console.log('URL:', testUrl);
  console.log('---');
  
  try {
    const result = await scrapeSaksFifthAvenue(testUrl);
    console.log('\n📊 Results:');
    console.log('Product:', result.name);
    console.log('Brand:', result.brand);
    console.log('Price:', result.price);
    console.log('Description:', result.description || 'No description found');
    
    // Also save the raw response for analysis
    const axios = require('axios');
    const { getAxiosConfig } = require('./config/proxy');
    
    const config = getAxiosConfig(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const response = await axios.get(testUrl, config);
    const fs = require('fs');
    fs.writeFileSync('saks-product2.html', response.data);
    console.log('\nHTML saved to saks-product2.html for analysis');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();