const { scrapeProduct } = require('./scrapers/index');

async function testWConceptFull() {
  const url = 'https://www.wconcept.com/product/flannel-pleats-midi-skirt-melange-grey-udsk4d222g2/720279268.html';

  console.log('Testing W Concept parser through main scraper with:', url);

  try {
    const result = await scrapeProduct(url);
    console.log('\n📦 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWConceptFull();