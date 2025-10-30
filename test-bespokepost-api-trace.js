const UniversalParserV3 = require('./universal-parser-v3');

// Patch the parser to log API data
const originalParse = UniversalParserV3.prototype.extractFromApiResponse;
UniversalParserV3.prototype.extractFromApiResponse = function(data, interceptedData, hostname) {
  console.log('\n=== API Response Data ===');
  console.log('Hostname:', hostname);

  // Call original
  originalParse.call(this, data, interceptedData, hostname);

  // Log what was found
  if (interceptedData.price) {
    console.log('✅ Found price in API:', interceptedData.price);
    console.log('Searching in data:', JSON.stringify(data).substring(0, 500));
  }
};

async function test() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/line-of-trade-x-harley-of-scotland-shetland-crew?rl=image';

  console.log('Testing:', url);
  const result = await parser.parse(url);

  console.log('\n💰 Final Result:');
  console.log('- Price:', result.price);
  console.log('- Name:', result.name);

  await parser.cleanup();
}

test().catch(console.error);
