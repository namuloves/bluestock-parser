const { scrapeMiuMiuWithPuppeteer } = require('./scrapers/miumiu-puppeteer');

async function testMiuMiuPriceExtraction() {
  // Test URL - you can replace with the actual $1220 sneakers URL
  const testUrls = [
    'https://www.miumiu.com/us/en/shoes/sneakers',
    // Add the specific product URL here if you have it
  ];

  for (const url of testUrls) {
    console.log('\n=== Testing Miu Miu Price Extraction ===');
    console.log('URL:', url);

    const result = await scrapeMiuMiuWithPuppeteer(url);

    if (result.success) {
      console.log('\n✅ Successfully scraped product:');
      console.log('Name:', result.product.name);
      console.log('Price:', result.product.price);
      console.log('SKU:', result.product.sku);

      // Check if price parsing is correct
      if (result.product.price) {
        const priceNumbers = result.product.price.match(/[\d,]+(?:\.\d+)?/);
        if (priceNumbers) {
          console.log('Extracted numeric price:', priceNumbers[0]);

          // Check for common truncation issues
          const numericPrice = parseFloat(priceNumbers[0].replace(',', ''));
          if (numericPrice === 1200 || numericPrice === 120) {
            console.log('⚠️  WARNING: Price might be truncated! Expected 1220 but got', numericPrice);
          }
        }
      }

      console.log('\nFull product data:', JSON.stringify(result.product, null, 2));
    } else {
      console.log('❌ Failed to scrape product');
      console.log('Error:', result.error);
    }
  }
}

// Run the test
testMiuMiuPriceExtraction().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});