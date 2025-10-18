/**
 * Test Quality Gate Implementation
 */

const { getQualityGate } = require('./utils/qualityGate');

console.log('🧪 Testing Quality Gate Implementation\n');
console.log('=' . repeat(50));

const qualityGate = getQualityGate();

// Test cases
const testCases = [
  {
    name: 'Valid Product',
    data: {
      name: 'Nike Air Max 90',
      price: 120.00,
      images: ['https://example.com/shoe1.jpg', 'https://example.com/shoe2.jpg'],
      brand: 'Nike',
      currency: 'USD',
      description: 'Classic Nike sneakers'
    },
    shouldPass: true
  },
  {
    name: 'Missing Required Field (price)',
    data: {
      name: 'Nike Air Max 90',
      images: ['https://example.com/shoe.jpg'],
      brand: 'Nike'
    },
    shouldPass: false
  },
  {
    name: 'Invalid Price (negative)',
    data: {
      name: 'Test Product',
      price: -10,
      images: ['https://example.com/image.jpg']
    },
    shouldPass: false
  },
  {
    name: 'Placeholder Name',
    data: {
      name: 'undefined',
      price: 50,
      images: ['https://example.com/image.jpg']
    },
    shouldPass: false
  },
  {
    name: 'Empty Images Array',
    data: {
      name: 'Valid Product Name',
      price: 50,
      images: []
    },
    shouldPass: false
  },
  {
    name: 'Sale Price Higher Than Original',
    data: {
      name: 'On Sale Item',
      price: 50,
      sale_price: 75,
      images: ['https://example.com/image.jpg']
    },
    shouldPass: false
  },
  {
    name: 'Valid Sale Item',
    data: {
      name: 'Winter Jacket',
      price: 200,
      sale_price: 150,
      images: ['https://example.com/jacket.jpg'],
      brand: 'North Face',
      currency: 'USD'
    },
    shouldPass: true
  },
  {
    name: 'Name Identical to Brand',
    data: {
      name: 'Nike',
      price: 100,
      images: ['https://example.com/image.jpg'],
      brand: 'Nike'
    },
    shouldPass: false
  },
  {
    name: 'Suspiciously High Price',
    data: {
      name: 'Luxury Watch',
      price: 75000,
      images: ['https://example.com/watch.jpg']
    },
    shouldPass: false
  },
  {
    name: 'Product with Confidence Score (deprecated)',
    data: {
      name: 'Winter Boots',
      price: 50,
      images: ['https://example.com/image.jpg'],
      confidence: 0.85  // This should trigger deprecation warning
    },
    shouldPass: true
  }
];

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log('-' . repeat(40));

  const result = qualityGate.validate(testCase.data);

  const testPassed = result.valid === testCase.shouldPass;

  if (testPassed) {
    console.log('✅ PASSED');
    passed++;
  } else {
    console.log(`❌ FAILED - Expected ${testCase.shouldPass ? 'valid' : 'invalid'}, got ${result.valid ? 'valid' : 'invalid'}`);
    failed++;
  }

  if (!result.valid && result.errors.length > 0) {
    console.log('Errors:', result.errors.map(e => e.message).join(', '));
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log('⚠️ Warnings:', result.warnings.map(w => w.message).join(', '));
  }
});

// Show metrics
console.log('\n' + '=' . repeat(50));
console.log('📊 Quality Gate Metrics:');
const metrics = qualityGate.getMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Summary
console.log('\n' + '=' . repeat(50));
console.log(`\n📈 Test Results:`);
console.log(`  ✅ Passed: ${passed}/${testCases.length}`);
console.log(`  ❌ Failed: ${failed}/${testCases.length}`);
console.log(`  📊 Success Rate: ${(passed/testCases.length * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Quality Gate is working correctly.');
} else {
  console.log('\n⚠️ Some tests failed. Please review the implementation.');
}

console.log('\n💡 Key Improvements:');
console.log('  - No more confidence scores (0.5, 0.7 thresholds)');
console.log('  - Clear pass/fail validation');
console.log('  - Specific error messages');
console.log('  - Business rule enforcement');
console.log('  - JSON Schema validation');

process.exit(failed === 0 ? 0 : 1);