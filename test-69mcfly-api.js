const axios = require('axios');

async function testViaAPI() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/?pp=0&epik=dj0yJnU9MHBWbkhjc0ktN2ttTVp3RFZJcExNNXJkUDdLLW1tVzUmcD0xJm49MHU3Zm9GN0lKQ29qTVdMOVc4eUduUSZ0PUFBQUFBR2piUk5V';

  console.log('🌐 Testing 69mcfly.com via API endpoint...');
  console.log('URL:', url);

  try {
    // Try to detect which port the server is running on
    let serverUrl = 'http://localhost:3001';

    const response = await axios.post(`${serverUrl}/scrape`, {
      url: url
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ API SUCCESS:');
    console.log('Status:', response.status);
    console.log('Product name:', response.data.product_name);
    console.log('Price:', response.data.sale_price || response.data.price);
    console.log('Brand:', response.data.brand);
    console.log('Images count:', response.data.image_urls?.length || 0);
    console.log('Platform:', response.data.platform);

    if (response.data.image_urls && response.data.image_urls.length > 0) {
      console.log('First image:', response.data.image_urls[0]);
    }

  } catch (error) {
    console.error('\n❌ API ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.message);
      console.error('Trying to connect to server...');

      // Check if server is running
      try {
        const healthCheck = await axios.get('http://localhost:3001/health');
        console.log('✅ Server is running on port 3001');
      } catch (healthError) {
        console.error('❌ Server not responding on port 3001:', healthError.message);
      }
    } else {
      console.error('Request setup error:', error.message);
    }
  }
}

testViaAPI();