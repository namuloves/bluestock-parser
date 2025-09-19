const axios = require('axios');
const cheerio = require('cheerio');

async function debugUniqlo() {
  const url = 'https://www.uniqlo.com/us/en/products/E459565-000/00';

  console.log('🔍 Debugging Uniqlo price extraction\n');

  try {
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);

    console.log('📄 HTML received:', response.data.length, 'bytes\n');

    // Look for price in various selectors
    const priceSelectors = [
      '.fr-ec-price-text',
      '.fr-ec-price',
      '.price-now',
      '.product-main-info__price',
      '[data-test="product-price-now"]',
      '.fr-field-set-price',
      '.product-price',
      'span[itemprop="price"]',
      '[data-price]',
      '.price'
    ];

    console.log('💰 Searching for price:\n');
    let priceFound = false;

    priceSelectors.forEach(selector => {
      const element = $(selector).first();
      const text = element.text()?.trim();
      const content = element.attr('content');
      const dataPrice = element.attr('data-price');

      if (text || content || dataPrice) {
        console.log(`  ✅ ${selector}: "${text || content || dataPrice}"`);
        priceFound = true;
      } else {
        console.log(`  ❌ ${selector}: not found`);
      }
    });

    // Check for JSON-LD data
    console.log('\n📊 Checking JSON-LD:');
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        console.log(`  Script ${i + 1}:`, JSON.stringify(data).substring(0, 200));

        if (data['@type'] === 'Product' || data.offers) {
          console.log('  Found Product data!');
          if (data.offers?.price) {
            console.log(`  ✅ Price in JSON-LD: ${data.offers.price}`);
            priceFound = true;
          }
        }
      } catch (e) {
        console.log(`  Script ${i + 1}: Parse error`);
      }
    });

    // Check for inline JavaScript with price data
    console.log('\n📜 Checking inline scripts for price:');
    let scriptPriceFound = false;

    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('price') && scriptContent.includes('product')) {
        // Look for price patterns in JavaScript
        const pricePatterns = [
          /"price":\s*([\d.]+)/,
          /"priceValue":\s*([\d.]+)/,
          /"salePrice":\s*([\d.]+)/,
          /"currentPrice":\s*([\d.]+)/,
          /price:\s*['"]?([\d.]+)/i
        ];

        for (const pattern of pricePatterns) {
          const match = scriptContent.match(pattern);
          if (match && !scriptPriceFound) {
            console.log(`  ✅ Found price in script: $${match[1]}`);
            scriptPriceFound = true;
            priceFound = true;
            break;
          }
        }
      }
    });

    if (!scriptPriceFound) {
      console.log('  ❌ No price found in inline scripts');
    }

    // Look for React/Next.js data
    console.log('\n⚛️ Checking for React/Next.js data:');
    const nextDataScript = $('#__NEXT_DATA__');
    if (nextDataScript.length > 0) {
      try {
        const nextData = JSON.parse(nextDataScript.html());
        console.log('  ✅ Found Next.js data');

        // Search for price in the Next.js props
        const searchForPrice = (obj, path = '') => {
          for (const [key, value] of Object.entries(obj || {})) {
            if (key.toLowerCase().includes('price') && typeof value === 'number') {
              console.log(`  ✅ Price at ${path}.${key}: $${value}`);
              priceFound = true;
            } else if (typeof value === 'object' && value !== null && path.length < 50) {
              searchForPrice(value, `${path}.${key}`);
            }
          }
        };

        searchForPrice(nextData.props);
      } catch (e) {
        console.log('  ❌ Could not parse Next.js data');
      }
    } else {
      console.log('  ❌ No Next.js data found');
    }

    console.log('\n📋 Summary:');
    console.log(`  Price found: ${priceFound ? '✅ Yes' : '❌ No'}`);

    if (!priceFound) {
      console.log('\n💡 Recommendation: Use Puppeteer to intercept API calls');
      console.log('   Uniqlo likely loads prices dynamically after page load');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

debugUniqlo();