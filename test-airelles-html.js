const axios = require('axios');
const cheerio = require('cheerio');

async function inspectHTML() {
  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    console.log('🔍 Inspecting Airelles HTML...\n');

    // Check og:image tags
    console.log('📸 OG Image tags:');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogImageUrl = $('meta[property="og:image:url"]').attr('content');
    console.log('og:image:', ogImage);
    console.log('og:image:url:', ogImageUrl);

    // Check all img tags with cdn.shopify.com
    console.log('\n📸 All img tags with cdn.shopify.com:');
    let count = 0;
    $('img[src*="cdn.shopify.com"]').each((i, el) => {
      const src = $(el).attr('src');
      const dataSrc = $(el).attr('data-src');
      const classes = $(el).attr('class');

      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('badge')) {
        count++;
        console.log(`\n${count}. src: ${src}`);
        console.log(`   classes: ${classes || 'none'}`);
        if (dataSrc) console.log(`   data-src: ${dataSrc}`);
      }
    });

    // Check product gallery
    console.log('\n📸 Product gallery images:');
    $('.product__media img, .product-image img, .product-photo img').each((i, el) => {
      const src = $(el).attr('src');
      const dataSrc = $(el).attr('data-src');
      if (src && src.includes('cdn.shopify.com')) {
        console.log(`${i + 1}. ${src}`);
        if (dataSrc) console.log(`   data-src: ${dataSrc}`);
      }
    });

    // Check data attributes
    console.log('\n📸 Images in data attributes:');
    $('[data-src*="cdn.shopify.com"], [data-zoom*="cdn.shopify.com"]').each((i, el) => {
      const dataSrc = $(el).attr('data-src');
      const dataZoom = $(el).attr('data-zoom');
      const tagName = el.tagName;

      console.log(`${i + 1}. <${tagName}>`);
      if (dataSrc) console.log(`   data-src: ${dataSrc}`);
      if (dataZoom) console.log(`   data-zoom: ${dataZoom}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspectHTML().catch(console.error);
