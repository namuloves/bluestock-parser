const { detectCategory } = require('./utils/enhancedCategoryDetection');

// Test data from the Bode jacket
const testData = {
  productName: 'Central Park Jacket - Ocre',
  description: 'A jacket inspired by Central Park, featuring unique design and quality construction.',
  brand: 'Bode',
  scrapedCategory: '',
  breadcrumbs: [],
  url: 'https://bode.com/products/central-park-jacket-ocre',
  metaTags: {},
  structuredData: {}
};

// Test the category detection
const detectedCategory = detectCategory(testData);

console.log('Testing Bode Jacket Categorization:');
console.log('=====================================');
console.log('Product Name:', testData.productName);
console.log('URL:', testData.url);
console.log('Detected Category:', detectedCategory);
console.log('=====================================');

// Also test with the simpler categoryDetection
const { detectCategory: simpleDetect } = require('./utils/categoryDetection');
const simpleCategory = simpleDetect(
  testData.productName,
  testData.description,
  testData.brand,
  testData.scrapedCategory
);

console.log('Simple Category Detection:', simpleCategory);