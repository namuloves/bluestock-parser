const axios = require('axios');

async function testEmurjNew() {
  const url = 'https://emurj.com/womens/diesel/t-bunny-tail-r1-t-shirt/101192';
  
  console.log('Testing EMURJ product (new URL):', url);
  console.log('Sending request to parser...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: url
    });
    
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.sizeChart) {
      const chart = response.data.sizeChart;
      console.log('\n✅ SIZE CHART FOUND!');
      console.log('Type:', chart.type);
      
      if (chart.type === 'table') {
        console.log('Headers:', chart.headers);
        console.log('Sample row:', chart.rows?.[0]);
        console.log('Total rows:', chart.rows?.length);
      } else if (chart.type === 'image') {
        console.log('Image URL:', chart.imageUrl?.substring(0, 100) + '...');
      } else if (chart.type === 'measurements') {
        console.log('Measurements:', chart.data);
      }
    } else if (!response.data.success) {
      console.log('\n❌ Failed to extract size chart');
      console.log('Error:', response.data.error);
      if (response.data.sizeChart?.requiresInteraction) {
        console.log('Note: This size chart requires interaction that could not be automated');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.response?.data || error.message);
  }
}

testEmurjNew();