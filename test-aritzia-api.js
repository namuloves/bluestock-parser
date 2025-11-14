const axios = require('axios');

async function testAritziaAPI() {
  console.log('🧪 Testing Aritzia through /scrape API endpoint...\n');

  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: 'https://www.aritzia.com/us/en/product/homestretch-rib-crew-longsleeve/102669.html?color=19631'
    }, {
      timeout: 90000 // 90 second timeout
    });

    console.log('✅ API Response received!');
    console.log('Success:', response.data.success);

    if (response.data.success) {
      const product = response.data.product;
      console.log('\n📦 Product Data:');
      console.log('  Name:', product.product_name || product.name);
      console.log('  Brand:', product.brand);
      console.log('  Price:', product.sale_price || product.price);
      console.log('  Images:', (product.image_urls || product.images || []).length);
      console.log('  Currency:', product.currency);
    } else {
      console.log('❌ Error:', response.data.error);
      console.log('User Message:', response.data.userMessage);
      console.log('Technical Error:', response.data.technicalError);
    }
  } catch (error) {
    if (error.response) {
      console.log('❌ Server responded with error:');
      console.log('  Status:', error.response.status);
      console.log('  Error:', error.response.data.error);
      console.log('  User Message:', error.response.data.userMessage);
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }
}

testAritziaAPI();