const { scrapeProduct } = require('./scrapers/index');

async function testCOS() {
  const url = 'https://www.cos.com/en-us/women/womenswear/knitwear/jumpers/product/checked-alpaca-blend-jumper-burgundy-checked-1293728001?utm_term=4260609087389&utm_campaign=cos_us_awareness_viewcontent_pinterest_prospecting-consideration_performance%2Bcatalog___wpro&utm_medium=PaidSocial&utm_source=Pinterest&utm_content=us-ww-cos-performance%2Bcatalog-022825&pp=0&epik=dj0yJnU9MVdob2xFWU1pSTBlbjJ1aXEwdnVtanFKMXZyTl82b1EmcD0xJm49YmlYVTZON0s0T0JWRURTNWRMUVRYZyZ0PUFBQUFBR2pNUGcw';

  console.log('Testing COS parser with:', url);

  try {
    const result = await scrapeProduct(url);
    console.log('\n📦 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCOS();