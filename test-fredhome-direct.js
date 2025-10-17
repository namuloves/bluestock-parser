/**
 * Test fredhome.com.au directly with the parser
 */

const axios = require('axios');

const testUrl = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';

async function testParser() {
  console.log('🔍 Testing parser directly with fredhome URL...\n');
  console.log('URL:', testUrl);
  console.log('---\n');

  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: testUrl
    }, {
      timeout: 30000
    });

    console.log('✅ Response received!\n');
    console.log('Success:', response.data.success);

    if (response.data.product) {
      const product = response.data.product;
      console.log('\n📦 Product Data:');
      console.log('- Name:', product.name || product.product_name || 'N/A');
      console.log('- Brand:', product.brand || 'N/A');
      console.log('- Price:', product.price || product.sale_price || 'N/A');
      console.log('- Currency:', product.currency || 'N/A');
      console.log('- Images:', Array.isArray(product.images) ? product.images.length : 0);
      console.log('- Description:', product.description ? product.description.substring(0, 100) + '...' : 'N/A');

      if (product.images && product.images.length > 0) {
        console.log('\n🖼️ First image:', product.images[0]);
      }

      console.log('\n📊 Full product object keys:', Object.keys(product));

      // Check if it matches frontend expectations
      console.log('\n✅ Frontend compatibility check:');
      console.log('- Has name/product_name:', !!(product.name || product.product_name));
      console.log('- Has price/sale_price:', !!(product.price || product.sale_price));
      console.log('- Has images:', !!(product.images && product.images.length > 0));

    } else {
      console.log('❌ No product data returned');
    }

    if (response.data.error) {
      console.log('\n❌ Error:', response.data.error);
    }

    // Save full response for inspection
    const fs = require('fs');
    fs.writeFileSync('fredhome-response.json', JSON.stringify(response.data, null, 2));
    console.log('\n💾 Full response saved to fredhome-response.json');

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Check server logs
async function checkLogs() {
  console.log('\n📊 Checking rollout metrics to see which parser was used...\n');

  try {
    const response = await axios.get('http://localhost:3001/api/rollout/metrics');
    const byDomain = response.data.detailed.byDomain['fredhome.com.au'];

    if (byDomain) {
      console.log('fredhome.com.au stats:');
      console.log('- Total requests:', byDomain.total);
      console.log('- Lean success:', byDomain.leanSuccess);
      console.log('- Lean failures:', byDomain.leanFailure);
      console.log('- Legacy success:', byDomain.legacySuccess);
      console.log('- Legacy failures:', byDomain.legacyFailure);
    } else {
      console.log('No stats yet for fredhome.com.au');
    }
  } catch (error) {
    console.log('Could not fetch metrics:', error.message);
  }
}

async function main() {
  await testParser();
  await checkLogs();
}

// Check if axios is installed
try {
  require.resolve('axios');
  main();
} catch (e) {
  console.log('Installing axios...');
  require('child_process').execSync('npm install axios', { stdio: 'inherit' });
  main();
}