const axios = require('axios');

async function testRailwayAPI() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/?pp=0&epik=dj0yJnU9MHBWbkhjc0ktN2ttTVp3RFZJcExNNXJkUDdLLW1tVzUmcD0xJm49MHU3Zm9GN0lKQ29qTVdMOVc4eUduUSZ0PUFBQUFBR2piUk5V';
  const railwayUrl = 'https://bluestock-parser.up.railway.app';

  console.log('🚂 Testing 69mcfly.com via Railway API...');
  console.log('URL:', url);
  console.log('Railway endpoint:', railwayUrl);

  try {
    // First check if Railway service is alive
    console.log('\n🏥 Checking Railway service health...');
    const healthResponse = await axios.get(`${railwayUrl}/health`, {
      timeout: 10000
    });
    console.log('✅ Railway service is alive:', healthResponse.status);

    // Now test the scraping endpoint
    console.log('\n🔍 Testing scraping endpoint...');
    const response = await axios.post(`${railwayUrl}/scrape`, {
      url: url
    }, {
      timeout: 120000, // 2 minute timeout for Railway
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ RAILWAY API SUCCESS:');
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

    // Check if it's actually getting good data
    if (!response.data.product_name || response.data.product_name.includes('placeholder')) {
      console.log('\n⚠️ WARNING: Product data seems incomplete or placeholder');
    } else {
      console.log('\n🎉 SUCCESS: Full product data extracted successfully!');
    }

  } catch (error) {
    console.error('\n❌ RAILWAY API ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      if (error.response.data) {
        console.error('Error data:', error.response.data);
      }
    } else if (error.request) {
      console.error('No response received:', error.message);
      console.error('Request timeout or network error');
    } else {
      console.error('Request setup error:', error.message);
    }

    // Additional debugging info
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testRailwayAPI();