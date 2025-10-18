const { scrapeProduct } = require('./scrapers/index');

const testUrl = 'https://chiclara.com/products/oversized-sweater-with-contrast-stitching?variant=44936391393455&pins_campaign_id=626755692937&utm_campaign=626755692937&utm_medium=PaidSocial&utm_source=Pinterest&utm_content=2680086328350&pp=0&epik=dj0yJnU9dVBVLWxjMlZ1c2FrUi1fSHZoZmFhNHpqWmxjNm94RDcmcD0xJm49amlSOWRHa1FjWFR1eFU3TlJ6WjdRUSZ0PUFBQUFBR2pKZFJj';

async function testChiclara() {
  console.log('\n🧪 Testing Chiclara with current scraper...\n');

  try {
    const result = await scrapeProduct(testUrl);

    if (result.success) {
      console.log('✅ Product scraped successfully!');
      console.log('\nProduct Details:');
      console.log('Name:', result.product.product_name || 'Not found');
      console.log('Brand:', result.product.brand || 'Not found');
      console.log('Price:', result.product.sale_price || 'Not found');
      console.log('Original Price:', result.product.original_price || 'Not found');
      console.log('Description:', result.product.description ? result.product.description.substring(0, 100) + '...' : 'Not found');
      console.log('Images found:', result.product.image_urls?.length || 0);
      console.log('Sizes:', result.product.sizes?.join(', ') || 'Not found');
      console.log('Colors:', result.product.colors?.join(', ') || 'Not found');

      if (result.product.image_urls && result.product.image_urls.length > 0) {
        console.log('\nFirst 3 image URLs:');
        result.product.image_urls.slice(0, 3).forEach((url, i) => {
          console.log(`${i + 1}. ${url}`);
        });
      }
    } else {
      console.log('❌ Failed to scrape product');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChiclara().catch(console.error);