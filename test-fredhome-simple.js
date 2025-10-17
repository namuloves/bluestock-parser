/**
 * Simple test for fredhome.com.au via server API
 */

const axios = require('axios');

const TEST_URL = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';

async function testViaServer() {
  console.log('🧪 Testing Fred Home Product via Server');
  console.log('URL:', TEST_URL);
  console.log('=' . repeat(50));

  try {
    console.log('\n📡 Calling /scrape endpoint...\n');

    const response = await axios.post('http://localhost:3001/scrape', {
      url: TEST_URL
    }, {
      timeout: 30000
    });

    if (response.data.success) {
      console.log('✅ PARSE SUCCESSFUL!\n');

      const product = response.data.product;

      console.log('📦 Product Details:');
      console.log('  Name:', product.product_name || product.name || 'N/A');
      console.log('  Price: $' + (product.sale_price || product.price || 'N/A'));
      console.log('  Brand:', product.brand || 'N/A');
      console.log('  Images:', product.image_urls?.length || 0);

      if (product.image_urls?.[0]) {
        console.log('  First Image:', product.image_urls[0].substring(0, 80) + '...');
      }

      console.log('\n📊 Metadata:');
      console.log('  Platform:', product.platform || 'N/A');
      console.log('  Source:', product.source || 'N/A');
      console.log('  Validation:', product.validation || 'N/A');

    } else {
      console.log('❌ PARSE FAILED\n');
      console.log('Error:', response.data.error || 'Unknown error');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server is not running!');
      console.error('Start it with: npm start');
    } else {
      console.error('❌ Error:', error.message);
      if (error.response?.data) {
        console.error('Response:', error.response.data);
      }
    }
  }
}

// Run test
testViaServer().then(() => {
  console.log('\n✅ Test complete');
}).catch(err => {
  console.error('Test failed:', err);
});