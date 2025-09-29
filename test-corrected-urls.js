const axios = require('axios');

async function testCorrectedUrls() {
  const imageUrls = [
    'https://cdn.wconcept.com/products/7203345/16/720334516_1.jpg',
    'https://cdn.wconcept.com/products/7203345/16/720334516_2.jpg',
    'https://cdn.wconcept.com/products/7203345/16/720334516_3.jpg',
    'https://cdn.wconcept.com/products/7203345/16/720334516_4.jpg',
    'https://cdn.wconcept.com/products/7203345/16/720334516_5.jpg',
    'https://cdn.wconcept.com/products/7203345/16/720334516_6.jpg'
  ];

  console.log('🔍 Testing corrected W Concept image URLs...\n');

  const validImages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    try {
      const response = await axios.head(url, { timeout: 5000 });
      const status = response.status;
      const contentType = response.headers['content-type'];
      const contentLength = response.headers['content-length'];

      console.log(`✅ Image ${i + 1}: ${status} | ${contentType} | ${contentLength} bytes`);
      console.log(`   ${url}`);
      validImages.push(url);
    } catch (error) {
      console.log(`❌ Image ${i + 1}: ${error.response?.status || 'FAILED'}`);
      console.log(`   ${url}`);
    }
    console.log('');
  }

  console.log(`📊 Summary: ${validImages.length}/${imageUrls.length} valid images found`);
}

testCorrectedUrls();