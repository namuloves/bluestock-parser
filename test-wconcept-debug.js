const axios = require('axios');
const cheerio = require('cheerio');

async function debugWConcept() {
  const url = 'https://www.wconcept.com/product/flannel-pleats-midi-skirt-melange-grey-udsk4d222g2/720279268.html';

  console.log('🔍 Fetching W Concept page for debugging...');

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Look for JSON-LD data
    console.log('\n📊 Looking for JSON-LD data...');
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        console.log(`\nJSON-LD #${i + 1}:`, JSON.stringify(json, null, 2).substring(0, 2000));
      } catch (e) {
        console.error(`Failed to parse JSON-LD #${i + 1}:`, e.message);
      }
    });

    // Look for product data in scripts
    console.log('\n📝 Looking for product data in scripts...');
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('product') && scriptContent.includes('price')) {
        const preview = scriptContent.substring(0, 500);
        if (preview.includes('price') || preview.includes('name')) {
          console.log(`Script #${i}:`, preview);
        }
      }
    });

    // Look for price elements
    console.log('\n💰 Looking for price elements...');
    const priceSelectors = [
      '.price',
      '.product-price',
      '[data-price]',
      '.price-sale',
      '.price-now',
      'span[class*="price"]',
      'div[class*="price"]',
      '[class*="Price"]',
      '.product_price',
      '.pd_price'
    ];

    priceSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`\n${selector}: ${elements.length} element(s) found`);
        elements.slice(0, 3).each((i, elem) => {
          const text = $(elem).text().trim();
          const className = $(elem).attr('class') || '';
          if (text) {
            console.log(`  [${i}] class="${className}" text="${text}"`);
          }
        });
      }
    });

    // Look for product name
    console.log('\n📦 Product name:');
    console.log('h1:', $('h1').first().text().trim());
    console.log('.product-name:', $('.product-name').text().trim());
    console.log('.product_name:', $('.product_name').text().trim());
    console.log('.pd_name:', $('.pd_name').text().trim());
    console.log('[data-product-name]:', $('[data-product-name]').text().trim());

    // Look for images
    console.log('\n🖼️ Images:');
    const imgSelectors = [
      '.product-image img',
      '.gallery img',
      '[data-product-image] img',
      '.swiper-slide img',
      '.product_img img',
      '.pd_img img'
    ];

    imgSelectors.forEach(selector => {
      const imgs = $(selector);
      if (imgs.length > 0) {
        console.log(`${selector}: ${imgs.length} found`);
        imgs.slice(0, 2).each((i, elem) => {
          const src = $(elem).attr('src') || $(elem).attr('data-src');
          if (src) console.log(`  [${i}] ${src.substring(0, 100)}...`);
        });
      }
    });

    // Check meta tags
    console.log('\n📋 Meta tags:');
    console.log('og:title:', $('meta[property="og:title"]').attr('content'));
    console.log('og:price:', $('meta[property="og:price:amount"]').attr('content') || $('meta[property="product:price:amount"]').attr('content'));
    console.log('og:image:', $('meta[property="og:image"]').attr('content'));
    console.log('og:description:', $('meta[property="og:description"]').attr('content'));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  }
}

debugWConcept();