const axios = require('axios');

async function testRailwayDirect() {
  console.log('🧪 Testing Railway API directly...');

  const testUrl = 'https://www.ebay.com/itm/375642461030';
  const railwayUrl = 'https://bluestock-parser.up.railway.app';

  try {
    console.log('🔍 Testing URL:', testUrl);
    console.log('🚂 Railway API:', railwayUrl);

    const response = await axios.post(`${railwayUrl}/scrape`, {
      url: testUrl
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Railway API response:');
    console.log('- Success:', response.data.success);
    console.log('- Product name:', response.data.product?.product_name || response.data.product?.name);
    console.log('- Images found:', response.data.product?.image_urls?.length || response.data.product?.images?.length || 0);
    console.log('- Platform:', response.data.product?.platform);

    if (response.data.product?.image_urls?.length > 0) {
      console.log('- First image:', response.data.product.image_urls[0]);
    } else if (response.data.product?.images?.length > 0) {
      console.log('- First image:', response.data.product.images[0]);
    } else {
      console.log('❌ NO IMAGES FOUND!');
    }

    console.log('\n📊 Full response structure:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Railway API failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRailwayDirect();