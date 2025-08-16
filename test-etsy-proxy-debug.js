process.env.USE_PROXY = 'true';
process.env.DECODO_USERNAME = 'spubcuhdc9';
process.env.DECODO_PASSWORD = 'nTDf2hlhI96r=eaNk4';

const axios = require('axios');
const { getAxiosConfig } = require('./config/proxy');

async function testEtsyWithProxy() {
  const url = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';
  
  console.log('Testing Etsy with proxy debug...\n');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  const axiosConfig = getAxiosConfig(url, {
    headers,
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => {
      console.log('Response status:', status);
      return status < 500;
    }
  });
  
  console.log('Config has httpsAgent?', !!axiosConfig.httpsAgent);
  
  try {
    console.log('Making request to Etsy...');
    const response = await axios.get(url, axiosConfig);
    console.log('✅ Success! Status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Content length:', response.data.length);
    
    // Check if it's HTML
    if (response.data.includes('<html')) {
      console.log('✅ Got HTML content');
    } else {
      console.log('⚠️ Response might not be HTML');
      console.log('First 500 chars:', response.data.substring(0, 500));
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
      if (error.response.status === 407) {
        console.log('Proxy authentication required!');
        console.log('Response data:', error.response.data?.substring(0, 500));
      }
    }
  }
}

testEtsyWithProxy();