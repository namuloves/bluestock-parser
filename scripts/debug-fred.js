const axios = require('axios');
const cheerio = require('cheerio');

async function debugFredHome() {
  const url = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';

  console.log('Fetching:', url);
  console.log('=' . repeat(50));

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Check what we're seeing
  console.log('\nPage Info:');
  console.log('  Title:', $('title').text().trim());
  console.log('  H1:', $('h1').first().text().trim());

  // Check all price elements
  console.log('\nPrice elements found:');
  const priceSelectors = [
    '.product-price',
    '.price',
    '.money',
    '.current-price',
    '.product__price',
    'span[class*="price"]'
  ];

  priceSelectors.forEach(sel => {
    $(sel).each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.includes('$')) {
        console.log(`  ${sel}: ${text}`);
      }
    });
  });

  // Check for Shopify product data
  console.log('\nChecking for Shopify data...');
  let foundVariantData = false;

  $('script').each((i, elem) => {
    const text = $(elem).html();
    if (text && text.includes('49833831072066')) {
      // Found the variant
      const priceMatch = text.match(/"price":\s*(\d+)/);
      if (priceMatch) {
        const priceInCents = parseInt(priceMatch[1]);
        console.log('  Found variant price:', priceInCents, 'cents =', '$' + (priceInCents / 100));
        foundVariantData = true;
      }
    }
  });

  // Check if price is being loaded by JavaScript
  const scripts = $('script[src*="product"]').length;
  console.log('\nProduct scripts found:', scripts);

  // Check for currency setting
  console.log('\nCurrency indicators:');
  const htmlLang = $('html').attr('lang');
  console.log('  HTML lang:', htmlLang);

  const currencyMeta = $('meta[property*="currency"]').attr('content');
  console.log('  Currency meta:', currencyMeta);

  // Search for AUD mentions
  const bodyText = $('body').text();
  if (bodyText.includes('AUD')) {
    console.log('  Found "AUD" in page text');
  }
  if (bodyText.includes('$225')) {
    console.log('  Found "$225" in page text');
  }

  // Check og:price
  const ogPrice = $('meta[property="og:price:amount"]').attr('content') ||
                  $('meta[property="product:price:amount"]').attr('content');
  if (ogPrice) {
    console.log('\nOG Price meta:', ogPrice);
  }
}

debugFredHome().catch(console.error);