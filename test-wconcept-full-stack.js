const { scrapeProduct } = require('./scrapers/index');

async function testFullStack() {
  const url = 'https://www.wconcept.com/product/pm-classic-pleated-midi-skirt/720334516.html';

  console.log('🔍 Testing W Concept through full scraping stack...');

  try {
    const result = await scrapeProduct(url);

    console.log('\n✅ Full Stack Result:');
    console.log('Success:', result.success);
    console.log('Product Name:', result.product?.product_name);
    console.log('Brand:', result.product?.brand);
    console.log('Price:', result.product?.sale_price);
    console.log('Original Price:', result.product?.original_price);
    console.log('Images Count:', result.product?.image_urls?.length || 0);
    console.log('Images:', result.product?.image_urls);
    console.log('In Stock:', result.product?.in_stock);
    console.log('Category:', result.product?.category);

    if (result.error) {
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFullStack();