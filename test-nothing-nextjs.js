const axios = require('axios');
const cheerio = require('cheerio');

async function testNothingNextJs() {
  const url = 'https://us.nothing.tech/products/cmf-headphone-pro?Colour=Dark+Grey';

  console.log('🔍 Fetching Nothing.tech page...');
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);

  console.log('\n📸 Checking for Next.js data...');
  const nextDataScript = $('#__NEXT_DATA__');

  if (nextDataScript.length > 0) {
    console.log('✅ Found __NEXT_DATA__ script');
    const scriptContent = nextDataScript.html();
    console.log('Script content length:', scriptContent?.length || 0);
    console.log('First 100 chars:', scriptContent?.substring(0, 100));

    try {
      const parsed = JSON.parse(scriptContent);
      console.log('✅ Successfully parsed Next.js data');
      console.log('Keys:', Object.keys(parsed));
    } catch (e) {
      console.error('❌ JSON parse error:', e.message);
      console.error('Content preview:', scriptContent?.substring(0, 200));
    }
  } else {
    console.log('❌ No __NEXT_DATA__ script found');
  }

  console.log('\n📦 Checking for JSON-LD...');
  $('script[type="application/ld+json"]').each((i, elem) => {
    console.log(`\nScript ${i + 1}:`);
    const content = $(elem).html();
    console.log('Length:', content?.length);
    console.log('First 100 chars:', content?.substring(0, 100));

    try {
      const parsed = JSON.parse(content);
      console.log('✅ Successfully parsed');
      if (parsed['@type']) console.log('Type:', parsed['@type']);
    } catch (e) {
      console.error('❌ JSON parse error:', e.message);
      console.error('Content preview:', content?.substring(0, 200));
    }
  });
}

testNothingNextJs().catch(console.error);
