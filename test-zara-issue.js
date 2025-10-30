const axios = require('axios');

async function testZaraParser() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('Testing Zara parser with URL:', url);
  console.log('---');

  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: url
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    console.log('✅ Success!');
    console.log('Response status:', response.status);
    console.log('Product data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testZaraParser();