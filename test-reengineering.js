const axios = require('axios');

const testUrls = [
  { site: 'Zara', url: 'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html' },
  { site: 'Nike', url: 'https://www.nike.com/t/dunk-low-retro-mens-shoes-76KnBL/DD1391-100' },
  { site: 'H&M', url: 'https://www2.hm.com/en_us/productpage.1236028001.html' },
  { site: 'Uniqlo', url: 'https://www.uniqlo.com/us/en/products/E462192-000' }
];

async function testParser(url, siteName) {
  try {
    const start = Date.now();
    const response = await axios.post('http://localhost:3001/scrape', { url });
    const duration = Date.now() - start;

    const data = response.data;
    const product = data.product || data;

    return {
      site: siteName,
      success: data.success || !!product.product_name,
      productName: product.product_name || product.name || 'Not found',
      price: product.original_price || product.price || 0,
      images: (product.image_urls || product.images || []).length,
      confidence: data.confidence || 'N/A',
      method: data.extraction_method || data.method || 'unknown',
      duration: duration + 'ms'
    };
  } catch (error) {
    return {
      site: siteName,
      success: false,
      error: error.message,
      duration: 'N/A'
    };
  }
}

async function runTests() {
  console.log('\n🧪 UNIVERSAL PARSER REENGINEERING TEST\n' + '='.repeat(60));
  console.log('Mode: ' + (process.env.UNIVERSAL_MODE || 'shadow'));
  console.log('Testing ' + testUrls.length + ' URLs...\n');

  const results = [];

  for (const test of testUrls) {
    console.log(`Testing ${test.site}...`);
    const result = await testParser(test.url, test.site);
    results.push(result);

    console.log(`✓ ${result.site}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.duration})`);
    if (result.success) {
      console.log(`  → ${result.productName} - $${result.price} - ${result.images} images`);
      console.log(`  → Method: ${result.method}, Confidence: ${result.confidence}`);
    } else {
      console.log(`  → Error: ${result.error || 'No data extracted'}`);
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  ✅ Successful: ${successful}/${testUrls.length}`);
  console.log(`  ❌ Failed: ${failed}/${testUrls.length}`);
  console.log(`  📈 Success Rate: ${((successful/testUrls.length) * 100).toFixed(1)}%`);

  // Check which extraction methods were used
  const methods = results.filter(r => r.success).map(r => r.method);
  const uniqueMethods = [...new Set(methods)];
  console.log(`  🔧 Extraction Methods Used: ${uniqueMethods.join(', ') || 'none'}`);

  // Performance
  const durations = results.filter(r => r.duration !== 'N/A').map(r => parseInt(r.duration));
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`  ⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);
  }
}

runTests().catch(console.error);