const UniversalParserEnhanced = require('./universal-parser-enhanced');

async function testEnhancedUniversal() {
  console.log('🧪 Testing Enhanced Universal Parser with Smart Image Extraction');

  const parser = new UniversalParserEnhanced();

  // Test with wconcept URL that should get multiple images
  const testUrls = [
    'https://www.wconcept.com/product/pm-classic-pleated-midi-skirt/720334516.html',
    'https://www.zara.com/us/en/ribbed-knit-cardigan-p02761203.html',
    'https://www.ssense.com/en-us/women/product/ganni/black-recycled-wool-cardigan/14277621'
  ];

  for (const url of testUrls) {
    console.log(`\n🔍 Testing: ${new URL(url).hostname}`);
    console.log(`URL: ${url}`);

    try {
      const startTime = Date.now();
      const result = await parser.parse(url);
      const duration = Date.now() - startTime;

      console.log('\n✅ Results:');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Confidence: ${Math.round((result.confidence || 0) * 100)}%`);
      console.log(`🏷️  Name: ${result.name || 'N/A'}`);
      console.log(`💰 Price: ${result.price || 'N/A'}`);
      console.log(`🏢 Brand: ${result.brand || 'N/A'}`);
      console.log(`📸 Images: ${result.images?.length || 0} found`);

      if (result.images && result.images.length > 0) {
        result.images.slice(0, 3).forEach((img, i) => {
          console.log(`   ${i + 1}. ${img}`);
        });
        if (result.images.length > 3) {
          console.log(`   ... and ${result.images.length - 3} more`);
        }
      }

      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      }

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }

    console.log('\n' + '─'.repeat(80));
  }
}

// Run test with error handling
testEnhancedUniversal().catch(console.error);