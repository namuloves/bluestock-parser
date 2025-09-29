const { scrapeWConcept } = require('./scrapers/wconcept');

async function testCurrentWConcept() {
  const url = 'https://www.wconcept.com/product/pm-classic-pleated-midi-skirt/720334516.html';

  console.log('🔍 Testing current W Concept parser...');

  try {
    const result = await scrapeWConcept(url);
    console.log('\n✅ Parser Result:');
    console.log('Name:', result.name);
    console.log('Price:', result.price);
    console.log('Brand:', result.brand);
    console.log('Images Count:', result.images?.length || 0);
    console.log('Images:', result.images);
    console.log('Color:', result.color);
    console.log('Sizes:', result.sizes);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCurrentWConcept();