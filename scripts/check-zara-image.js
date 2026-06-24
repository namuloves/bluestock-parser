const axios = require('axios');

async function checkZaraImage() {
  // The URL pattern we're currently generating
  const imageUrl = 'https://static.zara.net/photos//2024/V/0/1/p/0591/9105/800/2/w/850/05919105800_6_1_1.jpg';
  
  console.log('🔍 Checking if our Zara image URL works...');
  console.log('URL:', imageUrl);
  
  try {
    const response = await axios.get(imageUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      validateStatus: (status) => true // Accept any status
    });
    
    console.log('\nResponse Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    
    if (response.status === 200) {
      console.log('✅ Image URL is valid!');
    } else if (response.status === 403) {
      console.log('❌ Access forbidden - Zara is blocking the request');
    } else if (response.status === 404) {
      console.log('❌ Image not found - URL pattern is wrong');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Let's try to find a working Zara image URL pattern
  console.log('\n🔍 Testing alternative patterns...\n');
  
  const patterns = [
    // Remove the /p/ structure
    'https://static.zara.net/photos//2024/V/0/1/p/5919/105/800/2/w/563/5919105800_6_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/5919/105/800/2/w/563/5919105800_6_1_1.jpg',
    // Try without w parameter
    'https://static.zara.net/photos//2024/V/0/1/p/5919/105/800/2/5919105800_6_1_1.jpg',
    // Try simpler structure
    'https://static.zara.net/photos/2024/5919105800_1_1_1.jpg',
    // Try media server
    'https://media.zara.net/photos/2024/V/5919/105/800/5919105800_1_1_1.jpg',
    // Try CDN pattern
    'https://st.mngbcn.com/rcs/pics/static/T5/fotos/S20/05919105_99.jpg',
    // Generic placeholder
    'https://static.zara.net/photos//contents/mkt/spots/aw23-north-woman-new/subhome-xmedia-44//w/850/IMAGE-landscape-fill-7d6f7d6a-e3f9-44fd-aef0-e0315fb844c9-default_0.jpg'
  ];
  
  for (const url of patterns) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ WORKING: ${url}`);
      }
    } catch (error) {
      // Silent fail, just testing
    }
  }
  
  console.log('\n💡 Solution: Since Zara blocks direct image access, we should:');
  console.log('1. Return a placeholder image');
  console.log('2. Or return no images with a note');
  console.log('3. Or use a generic Zara product image');
}