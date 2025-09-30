const axios = require('axios');

async function testLocalWconcept() {
  console.log('🧪 Testing local wconcept parser...');

  const testUrl = 'https://www.wconcept.com/product/flannel-pleats-midi-skirt-melange-grey-udsk4d222g2/720279268.html';
  const localUrl = 'http://localhost:3002';

  try {
    console.log('🔍 Testing URL:', testUrl);
    console.log('🏠 Local API:', localUrl);

    const response = await axios.post(`${localUrl}/scrape`, {
      url: testUrl
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Local API response:');
    console.log('- Success:', response.data.success);
    console.log('- Product name:', response.data.product?.product_name || response.data.product?.name);
    console.log('- Images found:', response.data.product?.image_urls?.length || response.data.product?.images?.length || 0);
    console.log('- Platform:', response.data.product?.platform);

    if (response.data.product?.image_urls?.length > 0) {
      console.log('- First image:', response.data.product.image_urls[0]);
      console.log('- All images:', response.data.product.image_urls);
    } else if (response.data.product?.images?.length > 0) {
      console.log('- First image:', response.data.product.images[0]);
      console.log('- All images:', response.data.product.images);
    } else {
      console.log('❌ NO IMAGES FOUND!');
    }

    console.log('\n📊 Full response structure:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Local API failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testLocalWconcept();