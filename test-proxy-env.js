// Set env vars
process.env.USE_PROXY = 'true';
process.env.DECODO_USERNAME = 'spubcuhdc9';
process.env.DECODO_PASSWORD = 'nTDf2hlhI96r=eaNk4';

const { getProxyConfig, getAxiosConfig } = require('./config/proxy');

console.log('Testing proxy config from environment...\n');

console.log('Environment variables:');
console.log('USE_PROXY:', process.env.USE_PROXY);
console.log('DECODO_USERNAME:', process.env.DECODO_USERNAME);
console.log('DECODO_PASSWORD:', process.env.DECODO_PASSWORD);

const proxyConfig = getProxyConfig();
console.log('\nProxy config object:', proxyConfig ? 'Created' : 'NULL');

if (proxyConfig) {
  console.log('Should use proxy for etsy.com?', proxyConfig.shouldUseProxy('https://www.etsy.com/test'));
  console.log('Proxy sites:', proxyConfig.proxySites);
}

const axiosConfig = getAxiosConfig('https://www.etsy.com/test');
console.log('\nAxios config has httpsAgent?', !!axiosConfig.httpsAgent);

// Test actual request
const axios = require('axios');

async function testRequest() {
  try {
    console.log('\nTesting actual request to httpbin.org...');
    const testConfig = getAxiosConfig('https://httpbin.org/ip');
    const response = await axios.get('https://httpbin.org/ip', {
      ...testConfig,
      timeout: 10000
    });
    console.log('✅ Success! IP:', response.data.origin);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }
}

testRequest();