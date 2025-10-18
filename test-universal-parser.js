const UniversalParser = require('./universal-parser');
const { scrapeProduct } = require('./scrapers/index');

const testUrls = [
  // Sites with good structured data (should work well)
  {
    url: 'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html',
    site: 'Zara',
    expected: ['name', 'price', 'images']
  },
  {
    url: 'https://www2.hm.com/en_us/productpage.1236028001.html',
    site: 'H&M',
    expected: ['name', 'price']
  },
  {
    url: 'https://www.cos.com/en-us/women/womenswear/knitwear/product.relaxed-merino-wool-tank-top-grey.1251337002.html',
    site: 'COS',
    expected: ['name', 'price', 'images']
  },
  {
    url: 'https://us.boden.com/products/helen-cord-kilt-skirt-navy',
    site: 'Boden',
    expected: ['name', 'price', 'images']
  },
  // Sites that might need fallback
  {
    url: 'https://www.nordstrom.com/s/free-people-we-the-free-zephyr-denim-skirt/7812345',
    site: 'Nordstrom',
    expected: ['name']
  }
];

async function testUniversalParser() {
  console.log('========================================');
  console.log('  UNIVERSAL PARSER TEST SUITE');
  console.log('========================================\n');

  const parser = new UniversalParser();
  const results = [];

  for (const test of testUrls) {
    console.log(`\n🔍 Testing: ${test.site}`);
    console.log(`URL: ${test.url}`);
    console.log('-'.repeat(50));

    try {
      // Test Universal Parser directly
      console.log('\n1️⃣  Universal Parser Direct:');
      const universalResult = await parser.parse(test.url);

      const universalSummary = {
        url: test.url,
        site: test.site,
        method: 'universal',
        success: universalResult.confidence > 0.5,
        confidence: universalResult.confidence,
        hasName: !!universalResult.name,
        hasPrice: !!universalResult.price,
        imageCount: universalResult.images?.length || 0,
        sources: {
          name: universalResult.name_source,
          price: universalResult.price_source,
          images: universalResult.images_source
        },
        data: {
          name: universalResult.name,
          price: universalResult.price,
          brand: universalResult.brand,
          currency: universalResult.currency
        }
      };

      console.log('✅ Result:', {
        confidence: universalSummary.confidence.toFixed(2),
        name: universalSummary.hasName ? '✓' : '✗',
        price: universalSummary.hasPrice ? `✓ ${universalResult.price}` : '✗',
        images: `${universalSummary.imageCount} found`,
        brand: universalResult.brand || 'not found'
      });

      // Test through main scraper in shadow mode
      console.log('\n2️⃣  Through Main Scraper (Shadow Mode):');
      process.env.UNIVERSAL_MODE = 'shadow';
      const scraperResult = await scrapeProduct(test.url);

      console.log('✅ Site-specific scraper returned:', {
        success: scraperResult.success,
        hasProduct: !!scraperResult.product,
        productName: scraperResult.product?.product_name || scraperResult.product?.name
      });

      results.push({
        ...universalSummary,
        siteSpecificSuccess: scraperResult.success
      });

    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      results.push({
        url: test.url,
        site: test.site,
        error: error.message
      });
    }
  }

  // Summary Report
  console.log('\n\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => r.error);
  const avgConfidence = results
    .filter(r => r.confidence)
    .reduce((a, b) => a + b.confidence, 0) / results.length || 0;

  console.log(`📊 Total Tests: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📈 Average Confidence: ${avgConfidence.toFixed(2)}`);

  console.log('\n📋 Detailed Results:');
  console.log('Site            | Confidence | Name | Price | Images | Status');
  console.log('----------------|------------|------|-------|--------|--------');

  results.forEach(r => {
    const site = (r.site || 'Unknown').padEnd(15);
    const conf = r.confidence ? r.confidence.toFixed(2).padEnd(10) : 'N/A'.padEnd(10);
    const name = r.hasName ? '✓'.padEnd(5) : '✗'.padEnd(5);
    const price = r.hasPrice ? '✓'.padEnd(6) : '✗'.padEnd(6);
    const images = (r.imageCount || 0).toString().padEnd(7);
    const status = r.error ? 'ERROR' : (r.success ? 'OK' : 'LOW CONF');

    console.log(`${site} | ${conf} | ${name} | ${price} | ${images} | ${status}`);
  });

  // Test field extraction rates
  console.log('\n📊 Field Extraction Rates:');
  const fieldRates = {
    name: results.filter(r => r.hasName).length / results.length,
    price: results.filter(r => r.hasPrice).length / results.length,
    images: results.filter(r => r.imageCount > 0).length / results.length
  };

  console.log(`Name:   ${(fieldRates.name * 100).toFixed(1)}%`);
  console.log(`Price:  ${(fieldRates.price * 100).toFixed(1)}%`);
  console.log(`Images: ${(fieldRates.images * 100).toFixed(1)}%`);

  // Source strategy effectiveness
  console.log('\n🎯 Strategy Effectiveness:');
  const strategies = {};
  results.forEach(r => {
    if (r.sources) {
      Object.values(r.sources).forEach(source => {
        if (source) {
          strategies[source] = (strategies[source] || 0) + 1;
        }
      });
    }
  });

  Object.entries(strategies).forEach(([strategy, count]) => {
    console.log(`${strategy}: ${count} successful extractions`);
  });
}

// Run the tests
testUniversalParser().then(() => {
  console.log('\n✅ Test suite completed');
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});