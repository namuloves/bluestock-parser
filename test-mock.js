const axios = require('axios');
const path = require('path');

async function testMockSizeChart() {
  const mockFilePath = path.resolve(__dirname, 'test-mock-size-chart.html');
  const fileUrl = `file://${mockFilePath}`;
  
  console.log('Testing with mock HTML file:', fileUrl);
  
  try {
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: fileUrl,
      timeout: 10000
    });
    
    console.log('\nResponse:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      console.log('\n✅ Size chart successfully extracted!');
      const data = response.data.data;
      if (data.type === 'table') {
        console.log('Headers:', data.headers);
        console.log('First row:', data.rows[0]);
        console.log('Unit:', data.unit);
      }
    } else {
      console.log('\n❌ Failed to extract size chart from mock file');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testMockSizeChart();