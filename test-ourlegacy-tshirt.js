const { scrapeProduct } = require('./scrapers/index.js');

async function test() {
  try {
    const url = 'https://www.ourlegacy.com/new-box-t-shirt';
    console.log('Testing URL:', url);

    const result = await scrapeProduct(url);

    console.log('\n=== RESULT ===');
    console.log('Success:', result.success);
    console.log('Price:', result.product?.price);
    console.log('Sale Price:', result.product?.sale_price);
    console.log('Currency:', result.product?.currency);
    console.log('Currency Source:', result.product?.currency_detection_source);
    console.log('Price Text:', result.product?.price_text);
    console.log('\nFull Product Data:');
    console.log(JSON.stringify(result.product, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
