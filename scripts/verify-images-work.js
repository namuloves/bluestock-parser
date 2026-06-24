const axios = require('axios');

async function verifyImages() {
  const images = [
    'https://dam.bespokepost.com/image/upload/c_fill,dpr_auto,f_auto,h_1410,q_auto,w_1410/v1/freelance/finals/dark-energy-515/dark-energy-spectre-solar-panel',
    'https://dam.bespokepost.com/image/upload/freelance/finals/dark-energy-515/dark-energy-spectre-solar-panel',
    'https://dam.bespokepost.com/image/upload/freelance/finals/dark-energy-515/dark-energy-spectre-solar-panel-3',
    'https://dam.bespokepost.com/image/upload/freelance/finals/dark-energy-515/dark-energy-spectre-solar-panel-1',
    'https://dam.bespokepost.com/image/upload/freelance/finals/dark-energy-515/dark-energy-spectre-solar-panel-2'
  ];

  console.log('🔍 Verifying that parser-extracted images are valid and accessible:\n');

  for (let i = 0; i < images.length; i++) {
    const url = images[i];
    console.log(`${i + 1}. Testing: ${url.substring(0, 80)}...`);

    try {
      const response = await axios.head(url);
      const contentType = response.headers['content-type'];
      const contentLength = response.headers['content-length'];

      if (contentType && contentType.includes('image')) {
        console.log(`   ✅ Valid image (${contentType}, ${Math.round(contentLength/1024)}KB)`);
      } else {
        console.log(`   ⚠️ Not an image? Content-Type: ${contentType}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

verifyImages().catch(console.error);