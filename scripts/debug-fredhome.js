/**
 * Debug script to analyze fredhome.com.au product page
 */

const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';

async function debugFredhome() {
  console.log('🔍 Fetching fredhome page...\n');

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    console.log('📦 PRODUCT NAME:');
    console.log('h1.product__title:', $('h1.product__title').text().trim());
    console.log('h1:', $('h1').first().text().trim());
    console.log('meta og:title:', $('meta[property="og:title"]').attr('content'));
    console.log('');

    console.log('💰 PRICE SELECTORS:');
    console.log('.product__price .money:', $('.product__price .money').text().trim());
    console.log('span.product__price:', $('span.product__price').text().trim());
    console.log('.price--on-sale .money:', $('.price--on-sale .money').text().trim());
    console.log('meta product:price:amount:', $('meta[property="product:price:amount"]').attr('content'));

    // Look for any element with price-like content
    console.log('\n🔍 All elements containing "$":');
    $('*').each(function() {
      const text = $(this).text().trim();
      if (text.includes('$') && text.length < 20 && !text.includes('cart')) {
        console.log(`  ${this.name}.${$(this).attr('class')}: "${text}"`);
      }
    });

    console.log('\n🖼️ IMAGE SELECTORS:');
    console.log('.product__photos img count:', $('.product__photos img').length);
    console.log('.product-single__photo img count:', $('.product-single__photo img').length);
    console.log('.product__main-photos img count:', $('.product__main-photos img').length);

    // Find all images
    console.log('\n📸 All img tags:');
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        console.log(`  [${i}] ${alt || 'no-alt'}: ${src.substring(0, 80)}...`);
      }
    });

    // Check for Shopify-specific structures
    console.log('\n🛍️ SHOPIFY STRUCTURES:');
    console.log('Shopify product form:', $('form[action="/cart/add"]').length > 0 ? 'Found' : 'Not found');
    console.log('Variant selector:', $('#variant-select').length > 0 ? 'Found' : 'Not found');

    // Check for JSON-LD
    console.log('\n📊 STRUCTURED DATA:');
    $('script[type="application/ld+json"]').each((i, el) => {
      const json = $(el).html();
      if (json && json.includes('Product')) {
        try {
          const data = JSON.parse(json);
          if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].find(item => item['@type'] === 'Product'))) {
            console.log('Found Product JSON-LD');
            const product = data['@type'] === 'Product' ? data : data['@graph'].find(item => item['@type'] === 'Product');
            console.log('  Name:', product.name);
            console.log('  Price:', product.offers?.price);
            console.log('  Currency:', product.offers?.priceCurrency);
            console.log('  Image:', product.image?.[0] || product.image);
          }
        } catch (e) {
          console.log('Error parsing JSON-LD:', e.message);
        }
      }
    });

    // Save HTML for inspection
    const fs = require('fs');
    fs.writeFileSync('fredhome-debug.html', response.data);
    console.log('\n💾 Full HTML saved to fredhome-debug.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugFredhome();