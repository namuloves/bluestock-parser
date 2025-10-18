/**
 * Test Server Integration with Lean Parser
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🧪 Testing Server Integration with Lean Parser');
console.log('=' . repeat(50));

async function runTests() {
  try {
    // Test 1: Check parser version
    console.log('\n📌 Test 1: Check Parser Version');
    const versionRes = await axios.get(`${BASE_URL}/api/parser/version`);
    console.log('Current parser:', versionRes.data.current);
    console.log('Lean status:', versionRes.data.lean_status);

    if (versionRes.data.current !== 'lean') {
      console.log('⚠️ Warning: Not using lean parser. Set PARSER_VERSION=lean');
    } else {
      console.log('✅ Lean parser is active');
    }

    // Test 2: Quality Gate metrics
    console.log('\n📊 Test 2: Quality Gate Metrics');
    const qgRes = await axios.get(`${BASE_URL}/api/quality-gate/metrics`);
    console.log('Quality Gate status:', qgRes.data.status);
    console.log('Pass rate:', qgRes.data.metrics.passRate);

    // Test 3: Render Policy stats
    console.log('\n🎯 Test 3: Render Policy Stats');
    const renderRes = await axios.get(`${BASE_URL}/api/render-policy/stats`);
    console.log('Render rate:', renderRes.data.stats.renderRate);
    console.log('Budget:', renderRes.data.stats.budget);

    // Test 4: Circuit Breaker status
    console.log('\n🔌 Test 4: Circuit Breaker Status');
    const cbRes = await axios.get(`${BASE_URL}/api/circuit-breaker/status`);
    console.log('Total circuits:', cbRes.data.metrics.totalCircuits);
    console.log('Open circuits:', cbRes.data.metrics.openCircuits);

    // Test 5: Lean Parser metrics (if active)
    if (versionRes.data.current === 'lean') {
      console.log('\n✨ Test 5: Lean Parser Metrics');
      const leanRes = await axios.get(`${BASE_URL}/api/lean-parser/metrics`);
      console.log('Parser:', leanRes.data.parser);
      console.log('Plugins:', leanRes.data.metrics.plugins?.length || 0, 'loaded');
      console.log('Cache size:', leanRes.data.metrics.cache?.size || 0);
    }

    // Test 6: Parse a test URL
    console.log('\n🚀 Test 6: Parse Test URL');
    const parseRes = await axios.post(`${BASE_URL}/api/parse`, {
      url: 'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html'
    });

    if (parseRes.data.success) {
      console.log('✅ Parse successful');
      console.log('Product:', parseRes.data.product?.product_name);
      console.log('Price:', parseRes.data.product?.sale_price);
      console.log('Platform:', parseRes.data.product?.platform);

      // Check if using Quality Gate validation
      if (parseRes.data.product?.validation === 'quality-gate') {
        console.log('✅ Using Quality Gate validation (not confidence!)');
      }
    } else {
      console.log('❌ Parse failed:', parseRes.data.error);
    }

    // Summary
    console.log('\n' + '=' . repeat(50));
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('=' . repeat(50));

    const checks = {
      'Parser Version': versionRes.data.current === 'lean' ? '✅ Lean' : '⚠️ V3',
      'Quality Gate': qgRes.data.status === 'success' ? '✅ Active' : '❌ Failed',
      'Render Policy': renderRes.data.stats ? '✅ Active' : '❌ Failed',
      'Circuit Breaker': cbRes.data.metrics ? '✅ Active' : '❌ Failed',
      'Parse Working': parseRes.data.success ? '✅ Yes' : '❌ No'
    };

    for (const [check, status] of Object.entries(checks)) {
      console.log(`${check}: ${status}`);
    }

    const allPassed = Object.values(checks).every(s => s.includes('✅'));

    if (allPassed) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('The Lean Parser is fully integrated and working!');
    } else {
      console.log('\n⚠️ Some tests need attention');
      if (versionRes.data.current !== 'lean') {
        console.log('Hint: Set PARSER_VERSION=lean in .env and restart server');
      }
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Please start the server first:');
      console.error('   npm start');
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
  }
}

// Run tests
console.log('\nMake sure the server is running (npm start) before running this test.\n');

setTimeout(() => {
  runTests();
}, 1000);