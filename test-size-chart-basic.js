const axios = require('axios');

async function testSizeChart() {
  // Test with sites that are more likely to work
  const testUrls = [
    'https://www.cos.com/en_usd/men/clothing/shirts/product.regular-fit-shirt-white.1228073001.html',
    'https://www.ralphlauren.com/men-clothing-t-shirts/classic-fit-jersey-crewneck-t-shirt/0044963563.html',
    'https://www.garmentory.com/sale/jil-sander/women-tees-short-sleeve/1853835-oversized-logo-t-shirt'
  ];
  
  for (const url of testUrls) {
    console.log('\n' + '='.repeat(60));
    console.log('Testing:', url);
    console.log('='.repeat(60));
    
    try {
      const response = await axios.post('http://localhost:3001/parse-size-chart', {
        url: url,
        timeout: 45000
      });
      
      if (response.data.success && response.data.data) {
        console.log('✅ Size chart found!');
        console.log('Type:', response.data.data.type);
        
        const data = response.data.data;
        if (data.type === 'table') {
          console.log('Headers:', data.headers);
          console.log('Sample row:', data.rows[0]);
        } else if (data.type === 'image') {
          console.log('Image found:', data.alt_text);
        } else if (data.type === 'measurements') {
          console.log('Measurements:', JSON.stringify(data.data).substring(0, 100));
        }
      } else {
        console.log('❌ No size chart found');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.response?.data?.error || error.message);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testSizeChart().catch(console.error);