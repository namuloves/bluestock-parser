const UniversalParserV3 = require('./universal-parser-v3');
const cheerio = require('cheerio');
const fs = require('fs');

async function testBespokePost() {
  const parser = new UniversalParserV3();
  const url = 'https://www.bespokepost.com/store/line-of-trade-x-harley-of-scotland-shetland-crew?rl=image';

  console.log('Testing URL:', url);
  console.log('---');

  const result = await parser.parse(url);

  // Save HTML for inspection
  if (result.html) {
    fs.writeFileSync('/tmp/bespokepost.html', result.html);
    console.log('HTML saved to /tmp/bespokepost.html');
  }

  // Parse and check JSON-LD
  const $ = cheerio.load(result.html);
  console.log('\n=== JSON-LD Data ===');
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const content = $(elem).html();
      if (content && content.trim()) {
        const data = JSON.parse(content);
        if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
          console.log('Found Product JSON-LD:');
          console.log('- Name:', data.name || data.mainEntity?.name);
          console.log('- Price:', data.offers?.price || data.mainEntity?.offers?.price);
          console.log('- Price (array):', data.offers?.[0]?.price || data.mainEntity?.offers?.[0]?.price);
          console.log('Full JSON-LD:', JSON.stringify(data, null, 2).substring(0, 500));
        }
      }
    } catch (e) {
      console.log('Error parsing JSON-LD:', e.message);
    }
  });

  console.log('\n💰 Parser Result:');
  console.log('- Extracted price:', result.price);
  console.log('- Price text:', result.priceText);
  console.log('- Currency:', result.currency);
  console.log('- Name:', result.name);
  console.log('- Brand:', result.brand);
  console.log('- Confidence:', result.confidence);

  await parser.cleanup();
}

testBespokePost().catch(console.error);
