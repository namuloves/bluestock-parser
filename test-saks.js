const { scrapeSaksFifthAvenue } = require('./scrapers/saksfifthavenue');

async function test() {
  const testUrl = 'https://www.saksfifthavenue.com/product/hunza-g-crinkle-effect-scoopneck-bikini-0400022347462.html';
  
  console.log('🧪 Testing Saks Fifth Avenue scraper...');
  console.log('URL:', testUrl);
  console.log('---');
  
  try {
    const result = await scrapeSaksFifthAvenue(testUrl);
    console.log('\n📊 Scraping Results:');
    console.log('---');
    console.log('Product Name:', result.name);
    console.log('Brand:', result.brand);
    console.log('Price:', result.price);
    console.log('Original Price:', result.originalPrice);
    console.log('Currency:', result.currency);
    console.log('Color:', result.color);
    console.log('Available Colors:', result.colors);
    console.log('Sizes:', result.sizes);
    console.log('Product ID:', result.productId);
    console.log('In Stock:', result.inStock);
    console.log('Images Found:', result.images.length);
    console.log('Materials:', result.materials);
    console.log('Description:', result.description ? result.description.substring(0, 200) + '...' : 'N/A');
    
    if (result.error) {
      console.log('⚠️ Error encountered:', result.error);
    }
    
    console.log('\n🖼️ Image URLs:');
    result.images.slice(0, 3).forEach((img, i) => {
      console.log(`  ${i + 1}. ${img}`);
    });
    
    if (result.images.length > 3) {
      console.log(`  ... and ${result.images.length - 3} more images`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();