const axios = require('axios');
const cheerio = require('cheerio');

async function testButtonPrice() {
  const url = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';
  console.log('Testing Fred Home button price extraction...\n');

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Check add to cart button
  const button = $('button[name="add"]');
  if (button.length > 0) {
    const buttonText = button.text().trim();
    console.log('Add to cart button found:', buttonText);

    // Extract price
    const match = buttonText.match(/\$(\d+(?:\.\d+)?)/);
    if (match) {
      console.log('Price in button: $' + match[1] + ' AUD');
    }
  } else {
    console.log('No add to cart button found');
  }

  // Now test with the updated GenericExtractor
  console.log('\nTesting with GenericExtractor...');
  const GenericExtractor = require('./plugins/GenericExtractor');
  const extractor = new GenericExtractor();

  const result = extractor.extract($, url);
  console.log('Extracted price:', result.data.price);
  console.log('Extracted name:', result.data.name);
}

testButtonPrice().catch(console.error);