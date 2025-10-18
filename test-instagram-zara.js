const { scrapeProduct } = require('./scrapers');
const fs = require('fs').promises;

async function testNewScrapers() {
  console.log('🧪 Testing Instagram and Zara scrapers...\n');
  
  // Get Instagram and Zara URLs from our list
  const cleanedData = JSON.parse(await fs.readFile('cleaned-urls.json', 'utf8'));
  
  const testUrls = [];
  
  // Add Instagram URLs
  if (cleanedData.byDomain['www.instagram.com']) {
    console.log(`Found ${cleanedData.byDomain['www.instagram.com'].length} Instagram URLs`);
    testUrls.push(...cleanedData.byDomain['www.instagram.com'].slice(0, 2));
  }
  
  // Add Zara URLs
  if (cleanedData.byDomain['www.zara.com']) {
    console.log(`Found ${cleanedData.byDomain['www.zara.com'].length} Zara URLs`);
    testUrls.push(...cleanedData.byDomain['www.zara.com'].slice(0, 2));
  }
  
  // Add some test URLs if none found
  if (testUrls.length === 0) {
    console.log('No URLs found in spreadsheet, using test URLs');
    testUrls.push(
      'https://www.instagram.com/p/C1234567890/',
      'https://www.zara.com/us/en/ribbed-knit-top-p04424120.html'
    );
  }
  
  console.log(`\nTesting ${testUrls.length} URLs...\n`);
  
  for (const url of testUrls) {
    console.log('='.repeat(80));
    console.log(`Testing: ${url}`);
    console.log('='.repeat(80));
    
    try {
      const result = await scrapeProduct(url);
      
      if (result.success) {
        console.log('✅ Success!');
        console.log('Product:', result.product.product_name || result.product.name || 'Unknown');
        console.log('Brand:', result.product.brand || 'Unknown');
        console.log('Price:', result.product.sale_price || result.product.price || 'N/A');
        console.log('Images:', result.product.image_urls?.length || result.product.images?.length || 0);
        
        if (result.product.platform === 'instagram') {
          console.log('Instagram metadata:', result.product.metadata || 'N/A');
        }
        
        if (result.product.brand === 'Zara') {
          console.log('Sizes:', result.product.sizes?.join(', ') || 'N/A');
          console.log('Colors:', result.product.colors?.join(', ') || 'N/A');
        }
      } else {
        console.log('❌ Failed:', result.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
  }
  
  console.log('Testing complete!');
}

testNewScrapers().catch(console.error);