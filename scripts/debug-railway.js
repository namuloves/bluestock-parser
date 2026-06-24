const axios = require('axios');

async function debugRailway() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/';
  const railwayUrl = 'https://bluestock-parser.up.railway.app';

  console.log('🔍 DEBUG: Testing Railway response in detail...');

  try {
    const response = await axios.post(`${railwayUrl}/scrape`, {
      url: url
    }, {
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ Full Railway Response:');
    console.log('Status:', response.status);
    console.log('Product Data:', JSON.stringify(response.data, null, 2));

    if (response.data.product) {
      console.log('\n🔍 Product Details:');
      console.log('Name:', response.data.product.product_name);
      console.log('Price:', response.data.product.sale_price || response.data.product.price);
      console.log('Images:', response.data.product.image_urls?.length || 0);
      console.log('Platform:', response.data.product.platform);

      if (response.data.product.image_urls) {
        console.log('\n🖼️ All Images:');
        response.data.product.image_urls.forEach((img, i) => {
          console.log(`${i + 1}. ${img}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

debugRailway();