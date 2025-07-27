const { scrapeGarmentory } = require('./scrapers/garmentory');

async function testGarmentory() {
  // Test URL from user
  const testUrl = 'https://www.garmentory.com/sale/enza-costa/women-pants/2624270-enza-costa-twill-everywhere-pant';
  
  console.log('Testing Garmentory parser with:', testUrl);
  console.log('---');
  
  try {
    const result = await scrapeGarmentory(testUrl);
    
    if (result.success) {
      console.log('✅ Scraping successful!');
      console.log('\nProduct Data:');
      console.log('- Name:', result.product.product_name);
      console.log('- Brand:', result.product.brand);
      console.log('- Current Price:', result.product.current_price);
      console.log('- Original Price:', result.product.original_price);
      console.log('- On Sale:', result.product.on_sale);
      console.log('- Description:', result.product.description ? result.product.description.substring(0, 100) + '...' : 'None');
      console.log('- Images:', result.product.images.length);
      console.log('\nImage URLs:');
      result.product.images.forEach((img, index) => {
        console.log(`${index + 1}. ${img}`);
      });
    } else {
      console.log('❌ Scraping failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGarmentory();