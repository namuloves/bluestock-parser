const axios = require('axios');

async function testAPIWithClaude() {
  try {
    console.log('Testing API endpoint with Claude AI...\n');
    
    const response = await axios.post('http://localhost:3001/scrape', {
      url: 'https://www.ebay.com/itm/167374673335'
    });
    
    const product = response.data.product;
    
    console.log('=== API RESPONSE ===\n');
    console.log(`✅ Brand: ${product.brand}`);
    console.log(`📸 Photos: ${product.images?.length || product.image_urls?.length || 0} images`);
    console.log(`📝 Description: ${product.description}`);
    console.log(`💰 Price: ${product.price || product.sale_price}`);
    console.log(`🏷️ Platform: ${product.platform || 'Not specified'}`);
    
    // Check if AI context is present
    if (product.aiContext) {
      console.log('\n🤖 AI Context Present:', product.aiContext.needsDescription ? 'Yes' : 'No');
      console.log('AI Generated:', product.aiContext.generatedAt ? 'Yes' : 'No');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAPIWithClaude();