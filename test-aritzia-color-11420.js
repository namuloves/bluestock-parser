process.env.FIRECRAWL_API_KEY = 'fc-7bca30d0661446e7b59b6b7e54fe2f3f';

const { scrapeProduct } = require('./scrapers');

const testUrl = 'https://www.aritzia.com/us/en/product/isabelle-wool-cashmere-sweater/119992.html?color=11420';

async function test() {
  console.log('Testing exact Aritzia URL you used...\n');
  console.log('URL:', testUrl);
  console.log('='.repeat(80));

  try {
    const result = await scrapeProduct(testUrl);

    console.log('\n=== FULL RESULT ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.product) {
      console.log('\n=== SUMMARY ===');
      console.log('✅ Success:', result.success);
      console.log('Product Name:', result.product.product_name || result.product.name);
      console.log('Brand:', result.product.brand);
      console.log('Price:', result.product.sale_price || result.product.price);
      console.log('Image URLs count:', result.product.image_urls?.length || 0);
      console.log('Images count:', result.product.images?.length || 0);

      console.log('\n=== IMAGE URLS ===');
      if (result.product.image_urls && result.product.image_urls.length > 0) {
        result.product.image_urls.forEach((img, i) => {
          console.log(`${i + 1}. ${img}`);
        });
      } else if (result.product.images && result.product.images.length > 0) {
        result.product.images.forEach((img, i) => {
          console.log(`${i + 1}. ${img}`);
        });
      } else {
        console.log('❌ NO IMAGES FOUND!');
      }
    } else {
      console.log('\n❌ FAILED');
      console.log('Error:', result.error || 'Unknown error');
    }
  } catch (error) {
    console.log('\n❌ ERROR');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
  }
}

test().catch(console.error).finally(() => process.exit(0));
