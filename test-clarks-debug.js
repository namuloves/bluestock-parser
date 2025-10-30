const axios = require('axios');
const cheerio = require('cheerio');

async function testClarks() {
  const url = 'https://www.clarks.com/en-us/wallabee/26182834-p';

  console.log('🔍 Fetching Clarks page...');
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);

  console.log('\n📸 Checking for product images...');
  console.log('\n1. JSON-LD images:');
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const data = JSON.parse($(elem).html());
      if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
        const product = data.mainEntity || data;
        console.log('   Product name:', product.name);
        console.log('   Images:', JSON.stringify(product.image, null, 2));
      }
    } catch (e) {}
  });

  console.log('\n2. Open Graph images:');
  $('meta[property="og:image"]').each((i, el) => {
    console.log('  ', $(el).attr('content'));
  });

  console.log('\n3. Product gallery images:');
  const selectors = [
    '.product__media img',
    '.product-image img',
    '.swiper-slide img',
    '.gallery img',
    'img[src*="product"]',
    'img[srcset]'
  ];

  for (const selector of selectors) {
    const imgs = $(selector);
    if (imgs.length > 0) {
      console.log('   Selector:', selector, '- Found:', imgs.length, 'images');
      imgs.slice(0, 5).each((i, el) => {
        console.log('     -', $(el).attr('src') || $(el).attr('data-src') || 'no src');
      });
    }
  }

  console.log('\n4. All img tags with src:');
  const allImgs = $('img[src]');
  console.log('   Total img tags:', allImgs.length);

  console.log('\n5. Looking for specific Clarks patterns:');
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    const dataSrc = $(el).attr('data-src') || '';
    if (src.includes('26182834') || dataSrc.includes('26182834') ||
        src.includes('wallabee') || dataSrc.includes('wallabee')) {
      console.log('   Found:', src || dataSrc);
    }
  });
}

testClarks().catch(console.error);
