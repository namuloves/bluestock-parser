/**
 * Test parsing fredhome.com.au product
 */

const axios = require('axios');

const TEST_URL = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';
const PARSER_API = 'http://localhost:3001/scrape';

console.log('🧪 Testing Fredhome.com.au Product Parse');
console.log('=' . repeat(50));
console.log('URL:', TEST_URL);
console.log('=' . repeat(50));

async function testParse() {
  try {
    console.log('\n📡 Calling parser API...');

    const startTime = Date.now();
    const response = await axios.post(PARSER_API, {
      url: TEST_URL
    }, {
      timeout: 30000 // 30 seconds timeout
    });

    const duration = Date.now() - startTime;

    console.log(`⏱️ Parse completed in ${duration}ms`);

    if (response.data.success) {
      console.log('\n✅ PARSE SUCCESSFUL!');

      const product = response.data.product;

      console.log('\n📦 Product Details:');
      console.log('  Name:', product.product_name || product.name || 'N/A');
      console.log('  Brand:', product.brand || 'N/A');
      console.log('  Price:', product.sale_price || product.price || 'N/A');
      console.log('  Original Price:', product.original_price || 'N/A');
      console.log('  Currency:', product.currency || 'N/A');
      console.log('  Images:', product.image_urls?.length || product.images?.length || 0, 'images');
      console.log('  Platform:', product.platform || 'N/A');
      console.log('  Extraction Method:', product.source || response.data.extraction_method || 'N/A');

      if (product.validation) {
        console.log('  Validation:', product.validation);
      }

      if (product.description) {
        console.log('  Description:', product.description.substring(0, 100) + '...');
      }

      if (product.image_urls && product.image_urls.length > 0) {
        console.log('\n🖼️ First Image URL:');
        console.log('  ', product.image_urls[0]);
      }

      // Check if using lean parser features
      if (response.data.plugins_used) {
        console.log('\n🔌 Plugins Used:', response.data.plugins_used.join(', '));
      }

      if (response.data.rendered !== undefined) {
        console.log('🌐 Rendered:', response.data.rendered ? 'Yes' : 'No');
      }

      // Quality Gate validation info
      if (response.data.warnings && response.data.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        response.data.warnings.forEach(w => {
          console.log('  -', w.message || w);
        });
      }

    } else {
      console.log('\n❌ PARSE FAILED');

      if (response.data.error) {
        console.log('Error:', response.data.error);
      }

      if (response.data.errors) {
        console.log('Validation Errors:');
        response.data.errors.forEach(e => {
          console.log('  -', e.message || e);
        });
      }

      if (response.data.partial_data) {
        console.log('\n📦 Partial Data Extracted:');
        const partial = response.data.partial_data;
        console.log('  Name:', partial.name || 'N/A');
        console.log('  Price:', partial.price || 'N/A');
        console.log('  Images:', partial.images?.length || 0);
      }
    }

    // Show full response for debugging
    console.log('\n🔍 Full Response (debugging):');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️ Parser service is not running!');
      console.error('Please start it with:');
      console.error('  cd /Users/namu_1/bluestock-parser');
      console.error('  npm start');
    } else if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Also test direct lean parser without server
async function testDirectParser() {
  console.log('\n' + '=' . repeat(50));
  console.log('🧪 Testing Direct Lean Parser (without server)');
  console.log('=' . repeat(50));

  try {
    const { getLeanParser } = require('./universal-parser-lean');
    const parser = getLeanParser();

    console.log('Parser version:', parser.version);
    console.log('\n📡 Parsing directly...');

    const startTime = Date.now();
    const result = await parser.parse(TEST_URL);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Direct parse completed in ${duration}ms`);

    if (result.success) {
      console.log('✅ Direct parse successful!');
      console.log('Product name:', result.product.name);
      console.log('Price:', result.product.price);
      console.log('Images:', result.product.images?.length || 0);
      console.log('Plugins used:', result.plugins_used?.join(', ') || 'N/A');
      console.log('Rendered:', result.rendered ? 'Yes' : 'No');
    } else {
      console.log('❌ Direct parse failed:', result.error || result.errors?.[0]?.message);
    }

    // Cleanup
    await parser.cleanup();

  } catch (error) {
    console.error('Direct parser error:', error.message);
  }
}

// Run tests
async function runTests() {
  // Test via API first
  await testParse();

  // Then test direct parser
  await testDirectParser();

  console.log('\n✅ Tests complete!');
}

console.log('\n⚠️ Make sure the parser service is running (npm start) for API test.\n');

runTests();