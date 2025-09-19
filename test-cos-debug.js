const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('./config/proxy');

async function debugCOS() {
  const url = 'https://www.cos.com/en-us/women/womenswear/knitwear/jumpers/product/checked-alpaca-blend-jumper-burgundy-checked-1293728001';

  console.log('🔍 Fetching COS page for debugging...');

  try {
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    };

    const config = getAxiosConfig(url, baseConfig);
    const response = await axios.get(url, config);
    const html = response.data;
    const $ = cheerio.load(html);

    // Look for JSON-LD data
    console.log('\n📊 Looking for JSON-LD data...');
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        console.log(`\nJSON-LD #${i + 1}:`, JSON.stringify(json, null, 2));
      } catch (e) {
        console.error(`Failed to parse JSON-LD #${i + 1}:`, e.message);
      }
    });

    // Look for price elements
    console.log('\n💰 Looking for price elements...');
    const priceSelectors = [
      '.price',
      '.product-price',
      '[data-price]',
      '.price-sale',
      '.price-regular',
      'span[class*="price"]',
      'div[class*="price"]',
      '[class*="ProductPrice"]',
      '[class*="product-price"]'
    ];

    priceSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`\n${selector}: ${elements.length} element(s) found`);
        elements.each((i, elem) => {
          const text = $(elem).text().trim();
          const className = $(elem).attr('class') || '';
          if (text) {
            console.log(`  [${i}] class="${className}" text="${text}"`);
          }
        });
      }
    });

    // Check meta tags
    console.log('\n📋 Meta tags:');
    console.log('og:price:amount:', $('meta[property="og:price:amount"]').attr('content'));
    console.log('og:price:currency:', $('meta[property="og:price:currency"]').attr('content'));
    console.log('product:price:amount:', $('meta[property="product:price:amount"]').attr('content'));
    console.log('product:price:currency:', $('meta[property="product:price:currency"]').attr('content'));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  }
}

debugCOS();