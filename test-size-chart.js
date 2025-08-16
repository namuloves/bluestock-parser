const axios = require('axios');

// Test URLs with different size chart implementations
const testUrls = [
  // Shopify site with modal size chart
  'https://www.gymshark.com/products/gymshark-power-hoodie-black',
  
  // Site with table-based size chart
  'https://www.uniqlo.com/us/en/products/E455360-000/00',
  
  // Site with image-based size chart
  'https://www.zara.com/us/en/textured-shirt-p07545320.html',
  
  // Nike with interactive size guide
  'https://www.nike.com/t/dunk-low-retro-mens-shoes-76KnBL',
  
  // ASOS with comprehensive size guide
  'https://www.asos.com/us/asos-design/asos-design-oversized-t-shirt-in-black/prd/201234567'
];

async function testSizeChartParser(url) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing: ${url}`);
  console.log('='.repeat(80));
  
  try {
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: url,
      timeout: 30000
    });
    
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      console.log('✅ Size chart found!');
      console.log(`Type: ${data.type}`);
      
      if (data.type === 'table') {
        console.log(`Headers: ${data.headers.join(', ')}`);
        console.log(`Rows: ${data.rows.length} rows`);
        if (data.rows[0]) {
          console.log(`Sample row: ${data.rows[0].join(', ')}`);
        }
        console.log(`Unit: ${data.unit}`);
      } else if (data.type === 'image') {
        console.log(`Image: ${data.image_url.substring(0, 50)}...`);
        console.log(`Alt text: ${data.alt_text}`);
      } else if (data.type === 'measurements') {
        console.log(`Data: ${JSON.stringify(data.data).substring(0, 100)}...`);
        console.log(`Unit: ${data.unit}`);
      }
    } else {
      console.log('❌ No size chart found');
      if (response.data.message) {
        console.log(`Message: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
  }
}

async function runTests() {
  console.log('Starting size chart parser tests...\n');
  
  // Test each URL sequentially to avoid overwhelming the server
  for (const url of testUrls) {
    await testSizeChartParser(url);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Tests completed!');
  console.log('='.repeat(80));
}

// Run the tests
runTests().catch(console.error);