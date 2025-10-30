const UniversalParserV3 = require('./universal-parser-v3');
const axios = require('axios');
const cheerio = require('cheerio');

async function testImageSources() {
  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  // Fetch the HTML
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);

  console.log('🔍 Searching for all dam.bespokepost.com image references...\n');

  // Find all script tags
  $('script').each((i, elem) => {
    const content = $(elem).html() || '';

    // Find all dam.bespokepost.com URLs
    const damUrls = content.match(/https?:\/\/dam\.bespokepost\.com\/[^"'\s)]+/g);

    if (damUrls && damUrls.length > 0) {
      console.log(`Script ${i}:`);
      damUrls.forEach(url => {
        // Check if it's an icon
        const isIcon = url.includes('/icons/');
        // Check if it's incomplete
        const isIncomplete = url.endsWith('c_fill') || url.endsWith('c_limit');

        let flag = '';
        if (isIcon) flag = '❌ ICON';
        else if (isIncomplete) flag = '❌ INCOMPLETE';
        else flag = '✅ VALID';

        console.log(`  ${flag} ${url}`);
      });
      console.log();
    }
  });
}

testImageSources().catch(console.error);
