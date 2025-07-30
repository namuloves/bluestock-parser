const axios = require('axios');

async function testNordstrom() {
  const url = 'https://www.nordstrom.com/s/on-running-cloudmonster-running-shoe-women/8434199';
  
  try {
    console.log('Testing local scraper...');
    const response = await axios.post('http://localhost:3001/scrape', {
      url: url
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testNordstrom();