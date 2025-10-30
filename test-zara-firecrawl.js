const axios = require('axios');

async function testZaraWithFirecrawl() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('Testing Zara parser with Firecrawl/Universal parser...');
  console.log('URL:', url);
  console.log('---');

  try {
    // First, test with Universal Parser forced
    console.log('\n1️⃣ Testing with UNIVERSAL_MODE=full forced:');

    const response = await axios.post('http://localhost:3001/scrape', {
      url: url,
      forceUniversal: true  // Force universal parser
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (response.data.success) {
      console.log('✅ Success with Universal Parser!');
      console.log('Product name:', response.data.product?.product_name || response.data.product?.name);
      console.log('Price:', response.data.product?.sale_price || response.data.product?.price);
      console.log('Images found:', response.data.product?.image_urls?.length || response.data.product?.images?.length || 0);

      const images = response.data.product?.image_urls || response.data.product?.images || [];
      if (images.length > 0) {
        console.log('\nFirst 3 images:');
        images.slice(0, 3).forEach(img => {
          console.log('  -', img);
        });

        // Test if first image is accessible
        console.log('\nTesting first image accessibility:');
        try {
          const imgResponse = await axios.head(images[0], {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 5000,
            validateStatus: () => true
          });
          console.log(`  Status: ${imgResponse.status} ${imgResponse.status === 200 ? '✅' : '❌'}`);
        } catch (e) {
          console.log('  ❌ Error accessing image:', e.message);
        }
      }
    } else {
      console.log('❌ Failed:', response.data.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }

  // Also check current environment setting
  console.log('\n📊 Current parser configuration:');
  try {
    const configResponse = await axios.get('http://localhost:3001/api/parser/version');
    console.log('Parser version:', configResponse.data.current);
    console.log('Universal mode:', configResponse.data.features?.universal_mode || 'not set');
  } catch (e) {
    console.log('Could not fetch config');
  }
}

testZaraWithFirecrawl();