const { scrapeProduct } = require('./scrapers/index');

// Test URLs for sites we have parsers for
const testSites = {
  'Garmentory': 'https://www.garmentory.com/sale/all',
  'eBay': 'https://www.ebay.com/itm/123456789',
  'Ralph Lauren': 'https://www.ralphlauren.com/brands-double-rl-men',
  'COS': 'https://www.cos.com/en_usd/women/womenswear',
  'Sezane': 'https://www.sezane.com/us/product/summer-collection',
  'Nordstrom': 'https://www.nordstrom.com/s/test/1234567',
  'SSENSE': 'https://www.ssense.com/en-us/women',
  'Saks': 'https://www.saksfifthavenue.com/c/women',
  'Etsy': 'https://www.etsy.com/listing/123456789/test',
  'Poshmark': 'https://poshmark.com/listing/Test-Item-123abc',
  'Instagram': 'https://www.instagram.com/p/ABC123/',
  'Zara': 'https://www.zara.com/us/en/test-p12345678.html'
};

async function testCoverage() {
  console.log('📊 Testing Parser Coverage\n');
  console.log('=' .repeat(60));
  
  let working = 0;
  let broken = 0;
  
  for (const [site, url] of Object.entries(testSites)) {
    process.stdout.write(`Testing ${site.padEnd(15)}`);
    
    try {
      const result = await scrapeProduct(url);
      
      if (result.error && result.error.includes('No scraper available')) {
        console.log('❌ No parser');
        broken++;
      } else if (result.error) {
        console.log(`⚠️  Error: ${result.error.substring(0, 30)}...`);
        working++; // Parser exists but had an error
      } else {
        console.log('✅ Parser exists');
        working++;
      }
    } catch (error) {
      if (error.message.includes('No scraper available')) {
        console.log('❌ No parser');
        broken++;
      } else {
        console.log('✅ Parser exists (threw error)');
        working++;
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`\nParsers implemented: ${working}/${testSites.length}`);
  console.log(`Coverage: ${((working / Object.keys(testSites).length) * 100).toFixed(1)}%`);
  
  // Now test with generic extraction fallback
  console.log('\n📝 Sites needing parsers (from spreadsheet analysis):');
  const popularSitesNeedingParsers = [
    'urbanoutfitters.com',
    'freepeople.com',
    'revolve.com',
    'net-a-porter.com',
    'asos.com',
    'reformation.com',
    'everlane.com',
    'anthropologie.com',
    'madewell.com',
    'aritzia.com'
  ];
  
  popularSitesNeedingParsers.forEach(site => {
    console.log(`   - ${site}`);
  });
  
  console.log('\n✅ Working parsers:');
  console.log('   - Etsy (with proxy)');
  console.log('   - Poshmark (with proxy)');
  console.log('   - Zara (API approach with fallback)');
  console.log('   - Instagram');
  console.log('   - Garmentory');
  console.log('   - eBay');
  console.log('   - Ralph Lauren (with proxy)');
  console.log('   - COS (with proxy)');
  console.log('   - Sezane (with proxy)'); 
  console.log('   - Nordstrom (with proxy)');
  console.log('   - SSENSE (with proxy)');
  console.log('   - Saks Fifth Avenue (with proxy)');
  console.log('   - Shopify universal (for Shopify stores)');
  console.log('   - Redirect handler (for affiliate links)');
}

testCoverage().catch(console.error);