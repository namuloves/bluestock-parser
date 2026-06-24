const axios = require('axios');
const { getAxiosConfig } = require('./config/proxy');

async function debugZara() {
  const url = 'https://www.zara.com/us/en/zw-collection-lace-camisole-top-p05919105.html?v1=462615212&v2=2491343';
  
  console.log('🔍 Debugging Zara response...\n');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache'
  };
  
  const axiosConfig = getAxiosConfig(url, {
    headers,
    timeout: 30000,
    maxRedirects: 5
  });
  
  try {
    const response = await axios.get(url, axiosConfig);
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content length:', response.data.length);
    
    // Check what's in the response
    const html = response.data;
    
    // Look for common Zara/blocking patterns
    if (html.includes('cf-browser-verification')) {
      console.log('❌ Cloudflare protection detected');
    }
    if (html.includes('Access Denied')) {
      console.log('❌ Access denied page');
    }
    if (html.includes('__PRELOADED_STATE__')) {
      console.log('✅ Found Zara preloaded state');
    }
    if (html.includes('window.zara')) {
      console.log('✅ Found window.zara object');
    }
    if (html.includes('product-detail')) {
      console.log('✅ Found product detail elements');
    }
    
    // Save first 2000 chars to file
    console.log('\nFirst 500 chars of response:');
    console.log(html.substring(0, 500));
    
    // Look for product data in any script tags
    const scriptMatches = html.match(/<script[^>]*>.*?<\/script>/gs) || [];
    console.log(`\nFound ${scriptMatches.length} script tags`);
    
    // Check for API endpoints
    if (html.includes('/api/') || html.includes('v1/products')) {
      console.log('✅ Found API endpoints in page');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
    }
  }
}

debugZara();