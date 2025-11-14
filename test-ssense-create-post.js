const axios = require('axios');

async function testCreatePostParser() {
  const url = 'https://www.ssense.com/en-us/women/product/rick-owens-drkshdw/black-concordians-headband/18324131';

  console.log('🧪 Testing SSENSE via Create Post parser...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Test the create-post-parser endpoint
    const response = await axios.post('http://localhost:3001/create-post-parser', {
      url: url,
      userEmail: 'test@test.com'
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

      if (response.data.product.image_urls?.length > 0) {
        console.log('\n📸 Images:');
        response.data.product.image_urls.forEach((img, i) => {
          console.log(`  ${i + 1}. ${img}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCreatePostParser();
