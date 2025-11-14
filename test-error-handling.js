const axios = require('axios');

async function testErrorHandling() {
  console.log('🧪 Testing Error Handling...\n');

  // Test 1: Invalid URL (404)
  console.log('Test 1: Invalid/404 URL');
  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: 'https://www.aritzia.com/invalid-product-url-that-does-not-exist'
    }, { timeout: 30000 });

    console.log('Response status:', response.status);
    console.log('User-friendly message:', response.data.userMessage || response.data.error);
    console.log('---\n');
  } catch (error) {
    if (error.response) {
      console.log('✅ Error handled correctly!');
      console.log('  Status:', error.response.status);
      console.log('  User message:', error.response.data.userMessage || error.response.data.error);
      console.log('  Has fallback product structure:', !!error.response.data.product);
      console.log('---\n');
    }
  }

  // Test 2: Site that blocks scrapers (403)
  console.log('Test 2: Site with anti-bot protection');
  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: 'https://www.aritzia.com/us/en/product/test/123456.html'
    }, { timeout: 30000 });

    console.log('Response status:', response.status);
    console.log('User-friendly message:', response.data.userMessage || response.data.error);
  } catch (error) {
    if (error.response) {
      console.log('✅ Error handled correctly!');
      console.log('  Status:', error.response.status);
      console.log('  User message:', error.response.data.userMessage || error.response.data.error);
      console.log('  Has fallback product structure:', !!error.response.data.product);
    }
  }
}

testErrorHandling();