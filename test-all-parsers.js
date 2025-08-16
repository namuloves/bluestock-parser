const { scrapeProduct } = require('./scrapers/index');

// Test URLs from the domain analysis spreadsheet
const testUrls = [
  // High frequency sites
  'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt',
  'https://poshmark.com/listing/Vintage-Levis-501-Jeans-65f8c9a7b2fd22e8e1234567',
  'https://www.instagram.com/p/C123456789/',
  'https://www.zara.com/us/en/zw-collection-lace-camisole-top-p05919105.html',
  
  // Shopify stores (should be handled by universal scraper)
  'https://www.shopdoen.com/products/penny-dress-black',
  'https://www.aritzia.com/us/en/product/sculpt-knit-tank/82819.html',
  
  // Redirect/affiliate links
  'https://bit.ly/3abc123',
  'https://go.shopmy.us/p-12345',
  
  // Sites with existing parsers
  'https://www.garmentory.com/sale/brand/clothing/product-123',
  'https://www.ssense.com/en-us/women/product/brand/item-name/1234567',
  'https://www.ralphlauren.com/men/polo-shirt/123456.html',
  'https://www.nordstrom.com/s/product-name/1234567',
  'https://www.saksfifthavenue.com/product/brand/item/1234567',
  
  // Sites that might need parsers
  'https://www.urbanoutfitters.com/shop/product-name',
  'https://www.freepeople.com/shop/product-name',
  'https://www.madewell.com/product-name-12345.html',
  'https://www.anthropologie.com/shop/product-name'
];

async function testAllParsers() {
  console.log('🧪 Testing all parsers with domain analysis URLs\n');
  console.log('=' .repeat(80));
  
  const results = {
    success: [],
    failed: [],
    partial: []
  };
  
  for (const url of testUrls) {
    console.log(`\n📍 Testing: ${url}`);
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const result = await scrapeProduct(url);
      const elapsed = Date.now() - startTime;
      
      if (result.error) {
        console.log(`❌ FAILED: ${result.error}`);
        results.failed.push({ url, error: result.error });
      } else if (result.name && result.price) {
        console.log(`✅ SUCCESS: ${result.name}`);
        console.log(`   Price: ${result.price}`);
        console.log(`   Images: ${result.images?.length || 0}`);
        console.log(`   Time: ${elapsed}ms`);
        results.success.push({ url, name: result.name, price: result.price });
      } else {
        console.log(`⚠️  PARTIAL: Missing critical data`);
        console.log(`   Name: ${result.name || 'Missing'}`);
        console.log(`   Price: ${result.price || 'Missing'}`);
        results.partial.push({ url, data: result });
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.failed.push({ url, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successful: ${results.success.length}/${testUrls.length}`);
  console.log(`⚠️  Partial: ${results.partial.length}/${testUrls.length}`);
  console.log(`❌ Failed: ${results.failed.length}/${testUrls.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n🔴 Failed URLs:');
    results.failed.forEach(f => {
      console.log(`   - ${f.url.split('/')[2]}: ${f.error}`);
    });
  }
  
  if (results.partial.length > 0) {
    console.log('\n🟡 Partial Results:');
    results.partial.forEach(p => {
      console.log(`   - ${p.url.split('/')[2]}`);
    });
  }
  
  // Calculate coverage
  const coverage = ((results.success.length / testUrls.length) * 100).toFixed(1);
  console.log(`\n📈 Parser Coverage: ${coverage}%`);
}

testAllParsers().catch(console.error);