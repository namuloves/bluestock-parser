const axios = require('axios');

async function testViaAPI() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/?pp=0&epik=dj0yJnU9MHBWbkhjc0ktN2ttTVp3RFZJcExNNXJkUDdLLW1tVzUmcD0xJm49MHU3Zm9GN0lKQ29qTVdMOVc4eUduUSZ0PUFBQUFBR2piUk5V';

  console.log('🌐 Testing 69mcfly.com via API endpoint on port 3003...');
  console.log('URL:', url);

  try {
    const response = await axios.post(`http://localhost:3003/scrape`, {
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
    console.log('Color:', response.data.color);
    console.log('Category:', response.data.category);
    console.log('Material:', response.data.material);

    if (response.data.image_urls && response.data.image_urls.length > 0) {
      console.log('First image:', response.data.image_urls[0]);
    }

    console.log('\n📊 Full response data:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ API ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Request setup error:', error.message);
    }
  }
}

testViaAPI();