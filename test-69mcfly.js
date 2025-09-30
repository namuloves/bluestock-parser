const { scrapeProduct } = require('./scrapers');

async function test69McFly() {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/?pp=0&epik=dj0yJnU9MHBWbkhjc0ktN2ttTVp3RFZJcExNNXJkUDdLLW1tVzUmcD0xJm49MHU3Zm9GN0lKQ29qTVdMOVc4eUduUSZ0PUFBQUFBR2piUk5V';

  console.log('🔍 Testing 69mcfly.com URL...');
  console.log('URL:', url);
  console.log('Time:', new Date().toISOString());

  try {
    const result = await scrapeProduct(url);

    console.log('\n✅ SUCCESS:');
    console.log('Success:', result.success);
    console.log('Platform:', result.product?.platform);
    console.log('Product name:', result.product?.product_name || result.product?.name);
    console.log('Price:', result.product?.price);
    console.log('Images count:', result.product?.image_urls?.length || result.product?.images?.length || 0);
    console.log('Brand:', result.product?.brand);

    // Check if the result actually has meaningful data
    if (!result.product?.product_name && !result.product?.name) {
      console.log('\n⚠️ WARNING: No product name found');
    }

    if (!result.product?.price && !result.product?.sale_price) {
      console.log('\n⚠️ WARNING: No price found');
    }

    if (!result.product?.image_urls?.length && !result.product?.images?.length) {
      console.log('\n⚠️ WARNING: No images found');
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

test69McFly();