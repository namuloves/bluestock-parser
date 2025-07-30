const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

async function testDecodoProxy() {
  console.log('🔍 Testing Decodo proxy connection...\n');
  
  // Test 1: Check proxy IP
  try {
    const proxyUrl = process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD
      ? `http://${process.env.DECODO_USERNAME}:${process.env.DECODO_PASSWORD}@gate.decodo.com:10001`
      : process.env.PROXY_URL;
      
    if (!proxyUrl) {
      console.error('❌ No proxy credentials found. Set DECODO_USERNAME and DECODO_PASSWORD or PROXY_URL');
      return;
    }
    
    console.log('1️⃣ Testing proxy IP...');
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    
    const ipResponse = await axios.get('https://ip.decodo.com/json', {
      httpAgent: proxyAgent,
      httpsAgent: proxyAgent,
      timeout: 30000
    });
    
    console.log('✅ Proxy IP:', ipResponse.data.ip);
    console.log('   Location:', ipResponse.data.country, ipResponse.data.city);
    
  } catch (error) {
    console.error('❌ Proxy IP test failed:', error.message);
    return;
  }
  
  // Test 2: Try to access Nordstrom
  try {
    console.log('\n2️⃣ Testing Nordstrom access through proxy...');
    
    const { getAxiosConfig } = require('./config/proxy');
    const testUrl = 'https://www.nordstrom.com/s/7608820';
    
    // Temporarily enable proxy
    process.env.USE_PROXY = 'true';
    
    const config = getAxiosConfig(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const response = await axios.get(testUrl, config);
    
    if (response.data.includes('unusual activity')) {
      console.log('⚠️  Nordstrom still blocking (may need residential proxies)');
    } else if (response.data.includes('Nordstrom')) {
      console.log('✅ Successfully accessed Nordstrom!');
      console.log('   Page title found:', response.data.match(/<title>(.*?)<\/title>/)?.[1]?.substring(0, 50) + '...');
    }
    
  } catch (error) {
    console.error('❌ Nordstrom test failed:', error.message);
  }
  
  console.log('\n📝 To use Decodo proxy, set these environment variables on Railway:');
  console.log('   USE_PROXY=true');
  console.log('   DECODO_USERNAME=your_username');
  console.log('   DECODO_PASSWORD=your_password');
}

testDecodoProxy();