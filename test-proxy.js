const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testProxy() {
  // Test proxy with different encoding methods
  const username = 'spubcuhdc9';
  const password = 'nTDf2hlhI96r=eaNk4';
  
  console.log('Testing proxy authentication...\n');
  
  // Method 1: URL encoding
  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  const proxyUrl1 = `http://${encodedUsername}:${encodedPassword}@gate.decodo.com:10001`;
  
  console.log('Method 1 - URL encoded:');
  console.log('Username:', encodedUsername);
  console.log('Password:', encodedPassword);
  console.log('Proxy URL:', proxyUrl1);
  
  try {
    const agent1 = new HttpsProxyAgent(proxyUrl1);
    const response1 = await axios.get('https://httpbin.org/ip', {
      httpAgent: agent1,
      httpsAgent: agent1,
      timeout: 10000
    });
    console.log('✅ Method 1 Success! IP:', response1.data.origin);
  } catch (error) {
    console.log('❌ Method 1 Failed:', error.message);
  }
  
  // Method 2: Raw password
  console.log('\nMethod 2 - Raw password:');
  const proxyUrl2 = `http://${username}:${password}@gate.decodo.com:10001`;
  console.log('Proxy URL:', proxyUrl2);
  
  try {
    const agent2 = new HttpsProxyAgent(proxyUrl2);
    const response2 = await axios.get('https://httpbin.org/ip', {
      httpAgent: agent2,
      httpsAgent: agent2,
      timeout: 10000
    });
    console.log('✅ Method 2 Success! IP:', response2.data.origin);
  } catch (error) {
    console.log('❌ Method 2 Failed:', error.message);
  }
}

testProxy();