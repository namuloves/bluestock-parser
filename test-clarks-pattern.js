const axios = require('axios');
const cheerio = require('cheerio');

async function testClarksPattern() {
  const url = 'https://www.clarks.com/en-us/wallabee/26182834-p';

  console.log('🔍 Fetching Clarks page...');
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const html = response.data;
  const $ = cheerio.load(html);

  console.log('\n📸 Looking for image patterns...');

  // Check for Next.js data or window.__NEXT_DATA__
  console.log('\n1. Checking for Next.js data:');
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      console.log('   Found Next.js data!');
      console.log('   Keys:', Object.keys(nextData));

      // Look for product data
      const pageProps = nextData?.props?.pageProps;
      if (pageProps) {
        console.log('   pageProps keys:', Object.keys(pageProps));
        if (pageProps.product) {
          console.log('   Product data:', JSON.stringify(pageProps.product, null, 2));
        }
      }
    } catch (e) {
      console.log('   Error parsing Next.js data:', e.message);
    }
  }

  // Check for product data in script tags
  console.log('\n2. Checking for product data in scripts:');
  $('script').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('26182834') && content.includes('image')) {
      console.log('   Found potential product data in script tag!');
      const lines = content.split('\n').filter(line =>
        line.includes('image') || line.includes('media') || line.includes('picture')
      );
      lines.slice(0, 10).forEach(line => {
        console.log('     ', line.trim().substring(0, 200));
      });
    }
  });

  // Try the pattern-based approach
  console.log('\n3. Testing image URL pattern:');
  const baseImage = 'https://cdn.media.amplience.net/i/clarks/26182834_GW_1';

  // Clarks images typically follow _GW_1, _GW_2, _GW_3 pattern
  const imageVariations = [];
  for (let i = 1; i <= 9; i++) {
    const imageUrl = `https://cdn.media.amplience.net/i/clarks/26182834_GW_${i}?fmt=auto&img404=imageNotFound&w=1440&qlt=default`;
    imageVariations.push(imageUrl);
  }

  console.log('   Testing image URLs:');
  for (const imgUrl of imageVariations) {
    try {
      const response = await axios.head(imgUrl, { timeout: 3000 });
      if (response.status === 200) {
        console.log(`   ✅ ${imgUrl}`);
      }
    } catch (error) {
      console.log(`   ❌ ${imgUrl} - ${error.response?.status || error.code}`);
    }
  }
}

testClarksPattern().catch(console.error);
