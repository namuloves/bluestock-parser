const axios = require('axios');

async function testSsense() {
  const url = 'https://www.ssense.com/en-us/women/product/issey-miyake/purple-chiffon-twist-top/18498641';

  console.log('🧪 Testing SSENSE parser...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: url
    }, {
      timeout: 120000
    });

    console.log('✅ Success!');
    console.log('Response status:', response.status);
    console.log('\nProduct data:', JSON.stringify(response.data, null, 2));

    // Highlight key fields
    if (response.data.product) {
      console.log('\n📊 Summary:');
      console.log('  Name:', response.data.product.product_name);
      console.log('  Price:', response.data.product.price);
      console.log('  Images:', response.data.product.image_urls?.length || 0);
      console.log('  Brand:', response.data.product.brand);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testSsense();
