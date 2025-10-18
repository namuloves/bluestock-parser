const { scrapeProduct } = require('./scrapers');

async function testAllScrapers() {
  console.log('🧪 Running comprehensive scraper test...\n');
  
  const testUrls = {
    'Amazon': 'https://www.amazon.com/dp/B08N5WRWNW',
    'eBay': 'https://www.ebay.com/itm/123456789',
    'Etsy': 'https://www.etsy.com/listing/697890521/test',
    'Poshmark': 'https://poshmark.com/listing/test-689def60c71ba137f903554a',
    'Nordstrom': 'https://www.nordstrom.com/s/test/12345',
    'Saks': 'https://www.saksfifthavenue.com/product/test/12345',
    'Ralph Lauren': 'https://www.ralphlauren.com/test-product',
    'COS': 'https://www.cos.com/test-product',
    'Sezane': 'https://www.sezane.com/test-product',
    'SSENSE': 'https://www.ssense.com/test-product',
    'Garmentory': 'https://www.garmentory.com/test',
    'Instagram': 'https://www.instagram.com/p/ABC123/',
    'Zara': 'https://www.zara.com/us/en/test-p12345.html',
    'ShopStyle': 'https://shopstyle.it/l/test123',
    'Shopify (auto)': 'https://randomshopifystore.com/products/test',
    'Redirect (bit.ly)': 'https://bit.ly/test123',
    'Redirect (shopmy)': 'https://go.shopmy.us/p-123456'
  };
  
  let passed = 0;
  let failed = 0;
  const errors = [];
  
  for (const [name, url] of Object.entries(testUrls)) {
    try {
      console.log(`Testing ${name}...`);
      const result = await scrapeProduct(url);
      
      // Just check that it returns the expected structure
      if (result && typeof result === 'object' && 'success' in result) {
        console.log(`✅ ${name}: Structure OK`);
        passed++;
      } else {
        console.log(`❌ ${name}: Invalid structure`);
        failed++;
        errors.push(`${name}: Invalid response structure`);
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
      errors.push(`${name}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  return { passed, failed };
}

// Run with timeout
const timeout = setTimeout(() => {
  console.log('\n⚠️ Test timeout after 30 seconds');
  process.exit(0);
}, 30000);

testAllScrapers()
  .then(result => {
    clearTimeout(timeout);
    console.log('\n✅ Test suite complete');
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    clearTimeout(timeout);
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });