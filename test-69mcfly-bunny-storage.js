const axios = require('axios');

async function testBunnyStorageUpload() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/?pp=0&epik=dj0yJnU9MHBWbkhjc0ktN2ttTVp3RFZJcExNNXJkUDdLLW1tVzUmcD0xJm49MHU3Zm9GN0lKQ29qTVdMOVc4eUduUSZ0PUFBQUFBR2piUk5V';
  const railwayUrl = 'https://bluestock-parser.up.railway.app';

  console.log('🚀 Testing 69mcfly.com with NEW Bunny Storage CDN-first setup...');
  console.log('URL:', url);
  console.log('Railway endpoint:', railwayUrl);

  try {
    console.log('\n🏥 Checking Railway service health...');
    const healthResponse = await axios.get(`${railwayUrl}/health`, {
      timeout: 10000
    });
    console.log('✅ Railway service is alive:', healthResponse.status);

    console.log('\n🔍 Testing NEW CDN-first scraping...');
    const startTime = Date.now();

    const response = await axios.post(`${railwayUrl}/scrape`, {
      url: url
    }, {
      timeout: 120000, // 2 minute timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    console.log('\n✅ CDN-FIRST SUCCESS:');
    console.log('Status:', response.status);
    console.log('Duration:', `${duration}ms`);
    console.log('Product name:', response.data.product_name);
    console.log('Price:', response.data.sale_price || response.data.price);
    console.log('Brand:', response.data.brand);
    console.log('Images count:', response.data.image_urls?.length || 0);
    console.log('Platform:', response.data.platform);

    if (response.data.image_urls && response.data.image_urls.length > 0) {
      console.log('\n🖼️ IMAGE ANALYSIS:');
      response.data.image_urls.forEach((imageUrl, index) => {
        console.log(`Image ${index + 1}:`, imageUrl);

        // Check if it's a Bunny CDN URL
        if (imageUrl.includes('bluestock.b-cdn.net')) {
          console.log(`✅ Image ${index + 1} is using Bunny CDN!`);

          // Check if it has optimization parameters
          if (imageUrl.includes('/optimize/')) {
            console.log(`🎯 Image ${index + 1} has optimization enabled!`);
          }

          // Check if it points to storage
          if (imageUrl.includes('/storage/bluestock-assets/')) {
            console.log(`📦 Image ${index + 1} is from Bunny Storage!`);
          }
        } else {
          console.log(`⚠️ Image ${index + 1} is NOT using Bunny CDN`);
        }
      });

      console.log('\n🎉 NEW ARCHITECTURE TEST RESULTS:');
      const allBunnyCDN = response.data.image_urls.every(url => url.includes('bluestock.b-cdn.net'));
      const allOptimized = response.data.image_urls.every(url => url.includes('/optimize/'));
      const allFromStorage = response.data.image_urls.every(url => url.includes('/storage/bluestock-assets/'));

      console.log('✅ All images using Bunny CDN:', allBunnyCDN ? 'YES' : 'NO');
      console.log('✅ All images optimized:', allOptimized ? 'YES' : 'NO');
      console.log('✅ All images from Storage:', allFromStorage ? 'YES' : 'NO');

      if (allBunnyCDN && allOptimized && allFromStorage) {
        console.log('\n🎊 SUCCESS: CDN-First architecture working perfectly!');
        console.log('🚀 Images are now:');
        console.log('   - Uploaded to Bunny Storage');
        console.log('   - Served via optimized CDN');
        console.log('   - No Supabase upload conflicts');
        console.log('   - Fast and reliable delivery');
      } else {
        console.log('\n⚠️ PARTIAL SUCCESS: Some images not using full CDN-first flow');
      }
    } else {
      console.log('\n❌ NO IMAGES FOUND - Something went wrong');
    }

  } catch (error) {
    console.error('\n❌ CDN-FIRST TEST ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      if (error.response.data) {
        console.error('Error data:', error.response.data);
      }
    } else if (error.request) {
      console.error('No response received:', error.message);
      console.error('Request timeout or network error');
    } else {
      console.error('Request setup error:', error.message);
    }

    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testBunnyStorageUpload();