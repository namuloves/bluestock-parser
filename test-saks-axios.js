const axios = require('axios');
const { getAxiosConfig } = require('./config/proxy');

async function testSaksWithAxios() {
  const url = 'https://www.saksfifthavenue.com/product/hunza-g-crinkle-effect-scoopneck-bikini-0400022347462.html';
  
  console.log('🔍 Testing Saks with Axios and proxy...');
  console.log('URL:', url);
  
  try {
    // Get axios config with proxy
    const config = getAxiosConfig(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('🔐 Making request with proxy...');
    const response = await axios.get(url, config);
    
    console.log('✅ Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    const html = response.data;
    console.log('HTML length:', html.length);
    
    // Check for DataDome
    if (html.includes('datadome') || html.includes('captcha-delivery')) {
      console.log('⚠️ DataDome challenge detected');
    }
    
    // Try to extract basic info
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    console.log('Page title:', titleMatch ? titleMatch[1] : 'Not found');
    
    // Check for product data
    const hasProductData = html.includes('product__price') || html.includes('product__brand');
    console.log('Has product data elements:', hasProductData);
    
    // Save HTML for inspection
    const fs = require('fs');
    fs.writeFileSync('saks-axios-response.html', html);
    console.log('📄 Response saved to saks-axios-response.html');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

// Also test if proxy config is working
console.log('🔍 Checking proxy configuration...');
const { getProxyConfig } = require('./config/proxy');
const proxyConfig = getProxyConfig();
if (proxyConfig) {
  console.log('✅ Proxy is configured');
  console.log('Proxy sites:', proxyConfig.proxySites);
  console.log('Should use proxy for Saks:', proxyConfig.shouldUseProxy('https://www.saksfifthavenue.com'));
} else {
  console.log('❌ No proxy configuration found');
}

testSaksWithAxios();