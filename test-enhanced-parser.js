const UniversalParserEnhanced = require('./universal-parser-enhanced');

async function testEnhancedParser() {
  console.log('========================================');
  console.log('  ENHANCED UNIVERSAL PARSER TEST');
  console.log('========================================\n');

  const parser = new UniversalParserEnhanced();

  const testCases = [
    {
      name: 'Boden (Direct fetch)',
      url: 'https://us.boden.com/products/helen-cord-kilt-skirt-navy',
      expectedMethod: 'direct'
    },
    {
      name: 'Zara (Might need browser)',
      url: 'https://www.zara.com/us/en/textured-dress-p04387450.html',
      expectedMethod: 'browser'
    }
  ];

  for (const test of testCases) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log('─'.repeat(50));

    try {
      const startTime = Date.now();
      const result = await parser.parse(test.url);
      const endTime = Date.now();

      console.log(`\n✅ Extraction completed in ${endTime - startTime}ms`);
      console.log(`Method used: ${result.extraction_method || 'unknown'}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);

      console.log('\nExtracted Data:');
      console.log(`  Name: ${result.name || '(not found)'}`);
      console.log(`  Price: ${result.price || '(not found)'}`);
      console.log(`  Brand: ${result.brand || '(not found)'}`);
      console.log(`  Images: ${result.images?.length || 0} found`);

      console.log('\nData Sources:');
      console.log(`  Name from: ${result.name_source || 'none'}`);
      console.log(`  Price from: ${result.price_source || 'none'}`);

      // Test caching
      console.log('\n📦 Testing cache...');
      const cachedStartTime = Date.now();
      const cachedResult = await parser.parse(test.url);
      const cachedEndTime = Date.now();

      if (cachedEndTime - cachedStartTime < 10) {
        console.log(`✅ Cache working! Second request took ${cachedEndTime - cachedStartTime}ms`);
      } else {
        console.log(`⚠️ Cache might not be working. Second request took ${cachedEndTime - cachedStartTime}ms`);
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  // Cleanup
  await parser.cleanup();
  console.log('\n✅ Test completed and browser cleaned up');
}

testEnhancedParser().catch(console.error);