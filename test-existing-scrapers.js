// Test existing scrapers to see which ones work

const testUrls = [
  { url: 'https://www.zara.com/us/en/ribbed-knit-polo-shirt-p03597402.html', scraper: 'zara' },
  { url: 'https://www.cos.com/en-usd/men/shirts/product.short-sleeved-linen-shirt-brown.1216632001.html', scraper: 'cos' },
  { url: 'https://www2.hm.com/en_us/productpage.1227154002.html', scraper: 'hm' },
  { url: 'https://www.uniqlo.com/us/en/products/E459565-000/00', scraper: 'uniqlo' },
  { url: 'https://www.aritzia.com/us/en/product/contour-longsleeve/106232.html', scraper: 'aritzia' }
];

async function testScrapers() {
  console.log('🔍 Testing existing site-specific scrapers\n');
  console.log('=' .repeat(60));

  for (const { url, scraper } of testUrls) {
    console.log(`\n📍 Testing ${scraper.toUpperCase()} scraper`);
    console.log(`   URL: ${url}`);
    console.log('-'.repeat(60));

    try {
      const scraperModule = require(`./scrapers/${scraper}`);
      const scraperFunc = scraperModule[`scrape${scraper.toUpperCase()}`] ||
                          scraperModule[`scrape${scraper.charAt(0).toUpperCase() + scraper.slice(1)}`] ||
                          scraperModule.scrapeHTML ||
                          scraperModule.default;

      if (!scraperFunc) {
        console.log(`   ❌ No scraper function found in ${scraper}.js`);
        continue;
      }

      const startTime = Date.now();
      const result = await scraperFunc(url);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`   ✅ Success! (${elapsed}s)`);
      console.log(`   📊 Results:`);
      console.log(`      Name: ${result.name ? result.name.substring(0, 50) : '❌ Not found'}`);
      console.log(`      Price: ${result.price ? '$' + result.price : '❌ Not found'}`);
      console.log(`      Brand: ${result.brand || '❌ Not found'}`);
      console.log(`      Images: ${result.images?.length || 0} found`);

      if (result.images?.length > 0) {
        console.log(`      First image: ${result.images[0].substring(0, 50)}...`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response?.status) {
        console.log(`      Status: ${error.response.status}`);
      }
    }

    console.log('-'.repeat(60));

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Test complete\n');
}

testScrapers().catch(console.error);