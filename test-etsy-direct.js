const axios = require('axios');

const testUrl = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';

console.log('🧪 Testing Etsy through API endpoint...\n');

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: testUrl
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response:');
    console.log('=======================');
    console.log('Success:', response.data.success);
    console.log('Product Name:', response.data.product?.product_name);
    console.log('Brand:', response.data.product?.brand);
    console.log('Price:', response.data.product?.sale_price);
    console.log('Images:', response.data.product?.image_urls?.length, 'images');
    console.log('Category:', response.data.product?.category);
    console.log('\nFull response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();