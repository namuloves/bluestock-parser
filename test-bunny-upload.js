const axios = require('axios');

async function testBunnyUpload() {
  console.log('🧪 Testing direct Bunny Storage upload...');

  // Test with a simple base64 image
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const imageBuffer = Buffer.from(testImageBase64, 'base64');

  const storageZone = 'bluestock-assets';
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;

  console.log('Storage zone:', storageZone);
  console.log('API key set:', !!apiKey);
  console.log('API key length:', apiKey?.length || 'undefined');

  if (!apiKey) {
    console.error('❌ BUNNY_STORAGE_API_KEY not set');
    return;
  }

  try {
    const filename = `test-${Date.now()}.png`;
    const uploadUrl = `https://storage.bunnycdn.com/${storageZone}/originals/${filename}`;

    console.log('📤 Uploading to:', uploadUrl);

    const response = await axios.put(uploadUrl, imageBuffer, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'image/png'
      },
      timeout: 30000
    });

    console.log('✅ Upload successful!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);

    // Test CDN URL
    const cdnUrl = `https://bluestock.b-cdn.net/storage/${storageZone}/originals/${filename}`;
    console.log('🔗 CDN URL:', cdnUrl);

    // Wait a moment for CDN propagation
    await new Promise(resolve => setTimeout(resolve, 2000));

    const cdnResponse = await axios.head(cdnUrl);
    console.log('✅ CDN accessible, status:', cdnResponse.status);

  } catch (error) {
    console.error('❌ Upload failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testBunnyUpload();