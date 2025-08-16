const axios = require('axios');

async function testEmurjSizeChart() {
  const url = 'https://emurj.com/womens/laura-andraschko/entitled-hoodie/100525';
  
  console.log('Testing Emurj product:', url);
  console.log('Sending request to parser...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: url,
      timeout: 60000 // 60 seconds
    });
    
    console.log('Response received:');
    console.log('Success:', response.data.success);
    
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      console.log('\n✅ SIZE CHART FOUND!');
      console.log('Type:', data.type);
      
      if (data.type === 'table') {
        console.log('\nTable Data:');
        console.log('Headers:', data.headers);
        console.log('Number of rows:', data.rows.length);
        console.log('\nFull table:');
        console.log('Headers:', data.headers.join(' | '));
        console.log('-'.repeat(50));
        data.rows.forEach(row => {
          console.log(row.join(' | '));
        });
        console.log('\nUnit:', data.unit);
      } else if (data.type === 'image') {
        console.log('Image URL:', data.image_url.substring(0, 100) + '...');
        console.log('Alt text:', data.alt_text);
      } else if (data.type === 'measurements') {
        console.log('Measurements:', JSON.stringify(data.data, null, 2));
        console.log('Unit:', data.unit);
      }
    } else {
      console.log('\n❌ No size chart found');
      if (response.data.message) {
        console.log('Message:', response.data.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.error || error.message);
  }
}

testEmurjSizeChart();