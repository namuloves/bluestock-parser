const UniversalParser = require('./universal-parser');

async function simpleTest() {
  console.log('========================================');
  console.log('  UNIVERSAL PARSER SIMPLE TEST');
  console.log('========================================\n');

  const parser = new UniversalParser();

  // Test with a simple product URL
  const testUrl = 'https://us.boden.com/products/helen-cord-kilt-skirt-navy';

  console.log('Testing URL:', testUrl);
  console.log('-'.repeat(50));

  try {
    const result = await parser.parse(testUrl);

    console.log('\n✅ Parsing successful!');
    console.log('\n📊 Results:');
    console.log('  Confidence:', result.confidence.toFixed(2));
    console.log('  Name:', result.name || '(not found)');
    console.log('  Price:', result.price || '(not found)');
    console.log('  Brand:', result.brand || '(not found)');
    console.log('  Images:', result.images?.length || 0, 'found');
    console.log('  Currency:', result.currency || '(not found)');

    console.log('\n📋 Data Sources:');
    console.log('  Name from:', result.name_source || 'none');
    console.log('  Price from:', result.price_source || 'none');
    console.log('  Brand from:', result.brand_source || 'none');

    if (result.images?.length > 0) {
      console.log('\n🖼️ Sample image:', result.images[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  // Test with main scraper in shadow mode
  console.log('\n\n========================================');
  console.log('  TESTING THROUGH MAIN SCRAPER (SHADOW)');
  console.log('========================================\n');

  process.env.UNIVERSAL_MODE = 'shadow';
  const { scrapeProduct } = require('./scrapers/index');

  try {
    const scraperResult = await scrapeProduct(testUrl);
    console.log('✅ Site-specific scraper successful');
    console.log('  Product:', scraperResult.product?.product_name || scraperResult.product?.name);
    console.log('  Price:', scraperResult.product?.price);
  } catch (error) {
    console.error('❌ Scraper error:', error.message);
  }
}

simpleTest().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});