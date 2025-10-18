const axios = require('axios');

async function testSizeChart() {
  // Test with a simple product URL that should have a size chart
  const testUrl = 'https://www.nordstrom.com/s/7609752';
  
  console.log('Testing size chart parser with:', testUrl);
  console.log('Making request to local server...');
  
  try {
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: testUrl,
      timeout: 60000 // 60 second timeout
    });
    
    console.log('\nResponse received:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSizeChart();