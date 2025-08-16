const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('./config/proxy');

const testUrl = 'https://www.etsy.com/listing/697890521/linen-skirt-fiona-long-linen-wrap-skirt';

async function debugEtsy() {
  console.log('🔍 Debugging Etsy scraper...\n');
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    const axiosConfig = getAxiosConfig(testUrl, {
      headers,
      timeout: 30000,
      maxRedirects: 5
    });
    
    console.log('📡 Fetching page...');
    const response = await axios.get(testUrl, axiosConfig);
    console.log('✅ Page fetched successfully');
    
    const $ = cheerio.load(response.data);
    
    // Debug price selectors
    console.log('\n💰 PRICE DEBUGGING:');
    console.log('================');
    
    // Try various price selectors
    const priceSelectors = [
      'p[data-buy-box-region="price"] .wt-text-title-largest',
      '.wt-text-title-03.wt-mr-xs-1',
      'span[data-selector="listing-page-price"]',
      'p.wt-text-title-largest',
      'span.currency-value',
      'meta[property="product:price:amount"]',
      'script[type="application/ld+json"]'
    ];
    
    priceSelectors.forEach(selector => {
      if (selector === 'meta[property="product:price:amount"]') {
        const metaPrice = $(selector).attr('content');
        console.log(`${selector}: ${metaPrice || 'not found'}`);
      } else if (selector === 'script[type="application/ld+json"]') {
        const scripts = $(selector);
        scripts.each((i, script) => {
          try {
            const data = JSON.parse($(script).html());
            if (data.offers || data.price) {
              console.log(`${selector}[${i}]:`, JSON.stringify(data.offers || data.price, null, 2).substring(0, 200));
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
      } else {
        const element = $(selector);
        if (element.length) {
          console.log(`${selector}: "${element.first().text().trim()}"`);
        }
      }
    });
    
    // Check for price in data attributes
    console.log('\nData attributes with "price":');
    $('[data-*price*]').each((i, el) => {
      if (i < 5) {
        const attrs = el.attribs;
        Object.keys(attrs).forEach(key => {
          if (key.includes('price')) {
            console.log(`  ${key}: ${attrs[key]}`);
          }
        });
      }
    });
    
    console.log('\n🏪 SHOP NAME DEBUGGING:');
    console.log('=====================');
    
    const shopSelectors = [
      'a[data-shop-name]',
      'span[data-shop-name]',
      'a[href*="/shop/"] span',
      'p.wt-text-caption a',
      'a.wt-text-link-no-underline span',
      'button[aria-label*="shop"] span',
      'div[data-appears-component-name="shop_home_header_title"] h1'
    ];
    
    shopSelectors.forEach(selector => {
      const element = $(selector);
      if (element.length) {
        if (selector === 'a[data-shop-name]') {
          console.log(`${selector}: "${element.attr('data-shop-name')}" (text: "${element.text().trim()}")`);
        } else {
          console.log(`${selector}: "${element.first().text().trim()}"`);
        }
      }
    });
    
    // Search for text containing price pattern
    console.log('\n📝 Text containing price patterns:');
    const pricePattern = /\$\d+(\.\d{2})?/g;
    const bodyText = $('body').text();
    const priceMatches = bodyText.match(pricePattern);
    if (priceMatches) {
      const uniquePrices = [...new Set(priceMatches)];
      console.log('Found prices:', uniquePrices.slice(0, 10));
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugEtsy();