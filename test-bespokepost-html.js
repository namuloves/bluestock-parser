const axios = require('axios');
const cheerio = require('cheerio');

async function fetchAndInspect() {
  const url = 'https://www.bespokepost.com/store/line-of-trade-x-harley-of-scotland-shetland-crew?rl=image';

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);

  // Check JSON-LD data
  console.log('\n=== JSON-LD Data ===');
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const content = $(elem).html();
      if (content && content.trim()) {
        const data = JSON.parse(content);
        if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
          console.log(JSON.stringify(data, null, 2));
        }
      }
    } catch (e) {
      // Skip
    }
  });

  // Check visible price on page
  console.log('\n=== Visible Price Elements ===');
  const priceSelectors = ['.price', '[itemprop="price"]', '.product-price', '[data-price]'];
  priceSelectors.forEach(selector => {
    const el = $(selector).first();
    if (el.length > 0) {
      console.log(`${selector}: ${el.text().trim()}`);
      console.log(`  HTML: ${el.html()}`);
    }
  });

  // Check meta tags
  console.log('\n=== Meta Tags ===');
  console.log('og:price:amount:', $('meta[property="og:price:amount"]').attr('content'));
  console.log('product:price:amount:', $('meta[property="product:price:amount"]').attr('content'));
}

fetchAndInspect().catch(console.error);
