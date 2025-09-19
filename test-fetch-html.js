const axios = require('axios');
const cheerio = require('cheerio');

async function testFetchAndExtract() {
  const url = 'https://www.zara.com/us/en/ribbed-knit-polo-shirt-p03597402.html';

  console.log(`\n🔍 Fetching HTML from: ${url}\n`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    console.log('📄 HTML received, length:', response.data.length);
    console.log('\n🔎 Looking for common selectors:\n');

    // Check for various common selectors
    const selectors = {
      'h1': $('h1').first().text()?.trim(),
      'h1.product-name': $('h1.product-name').first().text()?.trim(),
      '.product-detail-info__header-name': $('.product-detail-info__header-name').first().text()?.trim(),
      '[data-testid="product-name"]': $('[data-testid="product-name"]').first().text()?.trim(),
      '.price': $('.price').first().text()?.trim(),
      '.price__amount': $('.price__amount').first().text()?.trim(),
      '.price-current__amount': $('.price-current__amount').first().text()?.trim(),
      '[data-testid="price"]': $('[data-testid="price"]').first().text()?.trim(),
      'script[type="application/ld+json"]': $('script[type="application/ld+json"]').length,
      'meta[property="og:title"]': $('meta[property="og:title"]').attr('content'),
      'meta[property="og:price:amount"]': $('meta[property="og:price:amount"]').attr('content'),
      'title': $('title').text()?.trim()
    };

    for (const [selector, value] of Object.entries(selectors)) {
      if (value) {
        console.log(`  ✅ ${selector}: "${value}"`);
      } else {
        console.log(`  ❌ ${selector}: not found`);
      }
    }

    // Check for images
    console.log('\n🖼  Image selectors:');
    const imgSelectors = [
      '.media-image img',
      '.product-detail-images__image img',
      'picture img',
      'img[src*="product"]'
    ];

    for (const selector of imgSelectors) {
      const count = $(selector).length;
      if (count > 0) {
        const firstSrc = $(selector).first().attr('src');
        console.log(`  ✅ ${selector}: ${count} found`);
        if (firstSrc) {
          console.log(`     First: ${firstSrc.substring(0, 60)}...`);
        }
      } else {
        console.log(`  ❌ ${selector}: not found`);
      }
    }

    // Look for any script tags that might contain data
    console.log('\n📜 Script tags with potential data:');
    $('script').each((i, elem) => {
      const text = $(elem).html();
      if (text && text.includes('product') && text.includes('price')) {
        console.log(`  Found script tag ${i} with product/price keywords (${text.length} chars)`);
        // Check if it's JSON-like
        if (text.includes('{') && text.includes('}')) {
          // Try to extract product info
          const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
          const priceMatch = text.match(/"price"\s*:\s*([\d.]+)/);
          if (nameMatch) console.log(`    Product name found: "${nameMatch[1]}"`);
          if (priceMatch) console.log(`    Price found: ${priceMatch[1]}`);
        }
      }
    });

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Headers:`, error.response.headers);
    }
  }
}

testFetchAndExtract();