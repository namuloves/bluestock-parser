const { scrapeEbay } = require('./scrapers/ebay.js');

// Test URL provided by user
const testUrl = 'https://www.ebay.com/itm/167374673335?itmmeta=01K14BRXF4JH09M609ZQ9NZ3KG&hash=item26f84ed5b7';

async function testEbayScraper() {
  console.log('Testing eBay scraper...');
  console.log('URL:', testUrl);
  console.log('-'.repeat(80));
  
  try {
    const startTime = Date.now();
    const product = await scrapeEbay(testUrl);
    const elapsedTime = Date.now() - startTime;
    
    console.log('✅ Scraping completed successfully in', elapsedTime, 'ms\n');
    
    // Display results in a formatted way
    console.log('📦 PRODUCT INFORMATION:');
    console.log('-'.repeat(80));
    
    console.log('Title:', product.title || 'Not found');
    console.log('Brand:', product.brand || 'Not found');
    console.log('Item ID:', product.itemId);
    console.log('Platform:', product.platform);
    console.log('');
    
    console.log('💰 PRICING:');
    console.log('-'.repeat(80));
    console.log('Current Price:', product.price || 'Not found');
    if (product.priceNumeric) {
      console.log('Numeric Price:', product.priceNumeric);
    }
    if (product.onSale) {
      console.log('Original Price:', product.originalPrice);
      console.log('Discount:', product.discount + '%');
    }
    console.log('');
    
    console.log('📸 IMAGES:');
    console.log('-'.repeat(80));
    if (product.images && product.images.length > 0) {
      console.log(`Found ${product.images.length} image(s):`);
      product.images.forEach((img, index) => {
        console.log(`  ${index + 1}. ${img}`);
      });
    } else {
      console.log('No images found');
    }
    console.log('');
    
    console.log('📋 ITEM SPECIFICS:');
    console.log('-'.repeat(80));
    if (product.specifics && Object.keys(product.specifics).length > 0) {
      Object.entries(product.specifics).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else {
      console.log('No item specifics found');
    }
    console.log('');
    
    console.log('📌 ADDITIONAL INFO:');
    console.log('-'.repeat(80));
    console.log('Condition:', product.condition || 'Not specified');
    console.log('Availability:', product.availability || 'Not specified');
    console.log('Shipping:', product.shipping || 'Not specified');
    
    if (product.seller) {
      console.log('Seller:', product.seller.name || 'Not found');
      console.log('Seller Feedback:', product.seller.feedback || 'Not found');
    }
    
    console.log('');
    console.log('🔗 Clean URL:', product.url);
    
    // Save full result to JSON for debugging
    const fs = require('fs');
    const filename = `ebay-test-result-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(product, null, 2));
    console.log(`\n💾 Full result saved to: ${filename}`);
    
  } catch (error) {
    console.error('❌ Error during scraping:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testEbayScraper();