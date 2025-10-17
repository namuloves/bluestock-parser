/**
 * Test script for stelstores.com currency detection
 */

require('dotenv').config();
const axios = require('axios');

async function testStelstoresCurrency() {
  const url = 'https://stelstores.com/products/double-layer-short-trench-coat';

  console.log('🧪 Testing stelstores.com currency detection');
  console.log('=' . repeat(60));
  console.log(`URL: ${url}\n`);

  try {
    // Test the scraping endpoint
    console.log('📡 Sending request to parser...\n');

    const response = await axios.post('http://localhost:3001/scrape', {
      url: url
    }, {
      timeout: 60000
    });

    const data = response.data;

    console.log('✅ Scraping successful!\n');
    console.log('📦 Product Information:');
    console.log(`  Name: ${data.product_name}`);
    console.log(`  Brand: ${data.brand}`);
    console.log(`  Platform: ${data.platform}`);

    console.log('\n💱 Currency Information:');
    console.log(`  Detected Currency: ${data.currency}`);
    console.log(`  Confidence: ${data.currency_confidence}`);
    console.log(`  Exchange Rate: ${data.exchange_rate?.toFixed(4) || 'N/A'}`);

    console.log('\n💰 Pricing:');

    // Original currency prices
    if (data.original_currency_price !== null) {
      console.log(`  Original Price (${data.currency}): ${data.original_currency_price}`);
      console.log(`  Original Sale Price (${data.currency}): ${data.original_currency_original_price || data.original_currency_price}`);
    }

    // USD prices
    console.log(`  Price (USD): $${data.sale_price?.toFixed(2) || '0.00'}`);
    console.log(`  Original Price (USD): $${data.original_price?.toFixed(2) || '0.00'}`);
    console.log(`  USD Price Field: $${data.usd_price?.toFixed(2) || '0.00'}`);
    console.log(`  USD Original Price Field: $${data.usd_original_price?.toFixed(2) || '0.00'}`);

    // Images
    console.log(`\n🖼️ Images: ${data.image_urls?.length || 0} found`);

    // Additional metadata
    console.log('\n📊 Additional Data:');
    console.log(`  Color: ${data.color || 'Not detected'}`);
    console.log(`  Material: ${data.material || 'Not detected'}`);
    console.log(`  Category: ${data.category || 'Not detected'}`);
    console.log(`  On Sale: ${data.is_on_sale ? 'Yes' : 'No'}`);
    if (data.discount_percentage) {
      console.log(`  Discount: ${data.discount_percentage}%`);
    }

    // Check if currency conversion worked
    console.log('\n🔍 Validation:');
    if (data.currency === 'DKK') {
      const expectedUsdRange = { min: 100, max: 300 }; // Reasonable range for a trench coat
      const actualUsd = data.sale_price || data.usd_price;

      if (actualUsd >= expectedUsdRange.min && actualUsd <= expectedUsdRange.max) {
        console.log(`  ✅ Price conversion looks correct: $${actualUsd.toFixed(2)} is in expected range`);
      } else {
        console.log(`  ⚠️ Price might be incorrect: $${actualUsd.toFixed(2)}`);
        console.log(`     Expected range: $${expectedUsdRange.min}-$${expectedUsdRange.max}`);
      }

      // Check if it was incorrectly showing DKK as USD
      if (actualUsd > 1000) {
        console.log(`  ❌ Likely showing DKK value as USD!`);
      }
    }

    // Show raw response for debugging
    console.log('\n🔍 Raw Response (partial):');
    const debugData = {
      currency: data.currency,
      currency_confidence: data.currency_confidence,
      original_currency_price: data.original_currency_price,
      sale_price: data.sale_price,
      usd_price: data.usd_price,
      exchange_rate: data.exchange_rate
    };
    console.log(JSON.stringify(debugData, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
console.log('🚀 Starting stelstores.com currency test...\n');
testStelstoresCurrency()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test crashed:', error);
    process.exit(1);
  });