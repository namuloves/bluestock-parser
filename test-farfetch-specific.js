const { scrapeFarfetch } = require('./scrapers/farfetch');

async function testSpecificUrl() {
  const testUrl = 'https://www.farfetch.com/shopping/women/marant-etoile-axeliana-pintuck-detail-blouse-item-22947594.aspx?storeid=12448';
  
  console.log('🧪 Testing Farfetch scraper with URL:', testUrl);
  console.log('⏰ Starting at:', new Date().toISOString());
  
  try {
    const result = await scrapeFarfetch(testUrl);
    
    console.log('\n✅ Scraping completed!');
    console.log('📦 Full result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('- Name:', result.name);
    console.log('- Brand:', result.brand);
    console.log('- Price:', result.currency, result.price);
    console.log('- Original Price:', result.originalPrice || 'Not on sale');
    console.log('- Color:', result.color || 'Not specified');
    console.log('- Description:', result.description ? result.description.substring(0, 100) + '...' : 'None');
    console.log('- Images:', result.images?.length || 0, 'images found');
    if (result.images?.length > 0) {
      console.log('  First image:', result.images[0]);
    }
    console.log('- Sizes:', result.sizes?.join(', ') || 'No sizes found');
    console.log('- In Stock:', result.inStock);
    console.log('- Error:', result.error || 'None');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSpecificUrl();