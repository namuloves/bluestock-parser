const UniversalParser = require('./universal-parser-v3.js');

(async () => {
  const parser = new UniversalParser();

  try {
    console.log('🧪 Testing Universal Parser V3 with Aritzia URL...');
    console.log('📍 URL: https://www.aritzia.com/us/en/product/homestretch™-rib-crew-longsleeve/102669.html');
    console.log('⏳ This will use Puppeteer with stealth plugin...\n');

    const result = await parser.parse('https://www.aritzia.com/us/en/product/homestretch™-rib-crew-longsleeve/102669.html?color=19631');

    if (result) {
      console.log('✅ SUCCESS! Universal Parser handled Aritzia');
      console.log('\n📦 Product Data:');
      console.log('  Name:', result.name || 'Not found');
      console.log('  Brand:', result.brand || 'Not found');
      console.log('  Price:', result.price || 'Not found');
      console.log('  Images:', result.images ? result.images.length + ' found' : 'Not found');
      console.log('  Description:', result.description ? 'Found' : 'Not found');
    } else {
      console.log('❌ Parser returned no data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up browser instance
    if (parser.browserInstance) {
      await parser.browserInstance.close();
    }
    process.exit(0);
  }
})();