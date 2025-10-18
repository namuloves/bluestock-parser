const axios = require('axios');

async function findZaraImages() {
  const productId = '05919105';
  console.log('🔍 Testing Zara image URL patterns for product:', productId);
  
  // Common Zara CDN patterns
  const imagePatterns = [
    `https://static.zara.net/photos//2025/V/0/1/p/5919/105/800/2/${productId}_1_1.jpg`,
    `https://static.zara.net/photos//2025/V/0/1/p/5919/105/800/2/${productId}_2_1.jpg`,
    `https://static.zara.net/photos//2024/I/0/1/p/5919/105/800/2/${productId}_1_1.jpg`,
    `https://static.zara.net/assets/public/8b0e/7c4e/9f7f4c8fa0f3/c71957a8c3e9/${productId}-e1.jpg`,
    `https://static.zara.net/photos//${productId}/1.jpg?ts=1`,
    `https://static.zara.net/photos//contents/mkt/spots/aw24-north-woman-new/subhome-xmedia-44//w/1920/${productId}_1.jpg`,
    `https://static.zara.net/photos//2025/V/0/1/p/${productId.slice(0,4)}/${productId.slice(4)}/800/2/${productId}_1_1.jpg`
  ];
  
  console.log('\nTesting image URLs:');
  
  for (const url of imagePatterns) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 200) {
        console.log(`✅ FOUND: ${url}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Content-Length: ${response.headers['content-length']}`);
      } else {
        console.log(`❌ ${response.status}: ${url.substring(0, 60)}...`);
      }
    } catch (error) {
      console.log(`❌ Error: ${url.substring(0, 60)}...`);
    }
  }
  
  // Try to get the actual page to see the price
  console.log('\n🔍 Checking Zara product page structure...');
  
  try {
    // Try the mobile API endpoint
    const mobileUrl = `https://www.zara.com/us/en/products-details?productIds=${productId}&ajax=true`;
    const response = await axios.get(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'Referer': 'https://www.zara.com/'
      },
      timeout: 10000
    });
    
    if (response.data) {
      console.log('✅ Got product data from mobile endpoint');
      console.log('Data preview:', JSON.stringify(response.data).substring(0, 500));
    }
  } catch (error) {
    console.log('❌ Mobile endpoint failed:', error.message);
  }
}

findZaraImages();