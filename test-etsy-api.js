const axios = require('axios');

const testUrl = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';

console.log('🧪 Testing Etsy through API endpoint...\n');

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: testUrl
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response:');
    console.log('=======================');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Start server first
console.log('Starting server...');
const { spawn } = require('child_process');
const server = spawn('node', ['server.js'], {
  env: { 
    ...process.env, 
    USE_PROXY: 'true',
    DECODO_USERNAME: 'spubcuhdc9',
    DECODO_PASSWORD: 'nTDf2hlhI96r=eaNk4',
    PORT: '3001'
  }
});

server.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
  // Wait for server to be ready
  if (data.includes('running on port')) {
    setTimeout(() => {
      testAPI().then(() => {
        server.kill();
        process.exit(0);
      });
    }, 2000);
  }
});

server.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});