const { scrapeProduct } = require('./scrapers/index');

// Real product URLs for testing
const realUrls = [
  // Working parsers
  'https://www.zara.com/us/en/textured-shirt-p07545439.html',
  'https://www.etsy.com/listing/1439657234/vintage-90s-levis-501-jeans',
  'https://poshmark.com/listing/Reformation-Dress-67890abcdef12345',
  
  // Sites that need parsers (popular from spreadsheet)
  'https://www.urbanoutfitters.com/shop/uo-penny-denim-mini-skirt',
  'https://www.freepeople.com/shop/old-west-wrangler-maxi-dress',
  'https://www.revolve.com/lovers-and-friends-gillian-mini-dress/dp/LOVF-WD3379/',
  'https://www.net-a-porter.com/en-us/shop/product/bottega-veneta/bags/mini-bags/mini-jodie-intrecciato-leather-tote/46376663162806598',
  'https://www.asos.com/us/asos-design/asos-design-midi-skirt-in-soft-suiting/prd/204195815',
  
  // Shopify stores (should work with universal scraper)
  'https://www.reformation.com/products/tagliatelle-linen-dress',
  'https://www.everlane.com/products/womens-organic-cotton-box-cut-tee-black'
];

async function testRealProducts() {
  console.log('🧪 Testing parsers with REAL product URLs\n');
  console.log('=' .repeat(80));
  
  const results = {
    success: [],
    failed: [],
    partial: []
  };
  
  for (const url of realUrls) {
    const domain = new URL(url).hostname.replace('www.', '');
    console.log(`\n📍 Testing ${domain}`);
    console.log(`   URL: ${url}`);
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const result = await scrapeProduct(url);
      const elapsed = Date.now() - startTime;
      
      if (result.error) {
        console.log(`❌ FAILED: ${result.error}`);
        results.failed.push({ domain, error: result.error });
      } else if (result.name && result.price) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Name: ${result.name}`);
        console.log(`   Price: ${result.price}`);
        console.log(`   Images: ${result.images?.length || 0}`);
        console.log(`   Brand: ${result.brand || 'N/A'}`);
        console.log(`   Time: ${elapsed}ms`);
        results.success.push({ domain, name: result.name, price: result.price });
      } else {
        console.log(`⚠️  PARTIAL: Missing data`);
        console.log(`   Name: ${result.name || '❌ Missing'}`);
        console.log(`   Price: ${result.price || '❌ Missing'}`);
        console.log(`   Images: ${result.images?.length || 0}`);
        results.partial.push({ domain, data: result });
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.failed.push({ domain, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 PARSER TEST SUMMARY');
  console.log('='.repeat(80));
  
  const total = realUrls.length;
  console.log(`\n✅ Working: ${results.success.length}/${total} (${((results.success.length/total)*100).toFixed(1)}%)`);
  results.success.forEach(s => console.log(`   ✓ ${s.domain}: "${s.name.substring(0,40)}..." - ${s.price}`));
  
  console.log(`\n⚠️  Partial: ${results.partial.length}/${total}`);
  results.partial.forEach(p => console.log(`   ! ${p.domain}`));
  
  console.log(`\n❌ Failed: ${results.failed.length}/${total}`);
  results.failed.forEach(f => console.log(`   ✗ ${f.domain}: ${f.error.substring(0,50)}`));
  
  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('📝 RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  const needsParsers = results.failed.filter(f => f.error.includes('No scraper available'));
  if (needsParsers.length > 0) {
    console.log('\n🔧 Sites that need parsers:');
    needsParsers.forEach(n => console.log(`   - ${n.domain}`));
  }
  
  const brokenParsers = results.partial.concat(results.failed.filter(f => !f.error.includes('No scraper available')));
  if (brokenParsers.length > 0) {
    console.log('\n🔨 Parsers that need fixing:');
    brokenParsers.forEach(b => console.log(`   - ${b.domain}`));
  }
  
  console.log('\n💡 Current parser coverage: ' + ((results.success.length/total)*100).toFixed(1) + '%');
}

testRealProducts().catch(console.error);