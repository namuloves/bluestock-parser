const { scrapeFarfetch } = require('./scrapers/farfetch');

async function testFarfetch() {
  const testUrl = 'https://www.farfetch.com/shopping/women/ganni-floral-print-graphic-t-shirt-item-31313693.aspx?storeid=9783';
  
  console.log('🧪 Testing Farfetch scraper with URL:', testUrl);
  console.log('⏰ Starting at:', new Date().toISOString());
  
  try {
    const result = await scrapeFarfetch(testUrl);
    
    console.log('\n✅ Scraping completed successfully!');
    console.log('📦 Product data:');
    console.log(JSON.stringify(result, null, 2));
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('- Name:', result.name);
    console.log('- Brand:', result.brand);
    console.log('- Price:', result.currency, result.price);
    console.log('- Original Price:', result.originalPrice || 'Not on sale');
    console.log('- Color:', result.color || 'Not specified');
    console.log('- Images:', result.images?.length || 0, 'images found');
    console.log('- Sizes:', result.sizes?.join(', ') || 'No sizes found');
    console.log('- In Stock:', result.inStock);
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFarfetch();