const axios = require('axios');
const cheerio = require('cheerio');
const firecrawlKey = 'fc-7bca30d0661446e7b59b6b7e54fe2f3f';

async function findZaraPrice() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('💰 Finding price from Zara...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Call Firecrawl API
    const response = await axios.post('https://api.firecrawl.dev/v1/scrape', {
      url: url,
      formats: ['html'],
      waitFor: 3000
    }, {
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const html = response.data.data.html;
    console.log('✅ Got HTML from Firecrawl\n');

    // Load HTML into cheerio
    const $ = cheerio.load(html);

    // Try different price selectors
    const priceSelectors = [
      '.price__amount',
      '.money-amount__main',
      '.product-price',
      '.price-current',
      '[data-qa="product-price"]',
      '.product-detail-info__price',
      '[class*="price"]',
      '[class*="Price"]'
    ];

    console.log('🔍 Testing price selectors:\n');

    for (const selector of priceSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ "${selector}" - Found ${elements.length} elements:`);
        elements.each((i, el) => {
          const text = $(el).text().trim();
          const html = $(el).html();
          if (i < 3) {
            console.log(`   ${i + 1}. Text: "${text.substring(0, 50)}"`);
            console.log(`      HTML: ${html?.substring(0, 100)}`);
          }
        });
        console.log('');
      }
    }

    // Search for price patterns in HTML
    console.log('\n🔎 Searching for price patterns in HTML:\n');

    const pricePatterns = [
      /\$\d+\.\d{2}/g,
      /USD\s*\d+\.\d{2}/gi,
      /"price":\s*[\d.]+/gi,
      /data-price="[\d.]+"/gi,
      /"amount":\s*[\d.]+/gi
    ];

    for (const pattern of pricePatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        console.log(`✅ Pattern ${pattern}: Found ${unique.length} matches`);
        unique.slice(0, 5).forEach(m => console.log(`   - ${m}`));
        console.log('');
      }
    }

    // Look for JSON-LD structured data
    console.log('\n📊 Looking for JSON-LD structured data:\n');
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`Found ${jsonLdScripts.length} JSON-LD scripts`);

    jsonLdScripts.each((i, script) => {
      const content = $(script).html();
      if (content && content.includes('price')) {
        console.log(`\n📦 JSON-LD #${i + 1}:`);
        try {
          const json = JSON.parse(content);
          console.log(JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {
          console.log('Could not parse:', content.substring(0, 200));
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

findZaraPrice();
