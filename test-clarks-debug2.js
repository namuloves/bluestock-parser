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

  console.log('\n📸 Checking for lazy-loaded product images...');

  console.log('\n1. Checking .swiper-slide img for data attributes:');
  $('.swiper-slide img').slice(0, 10).each((i, el) => {
    const $el = $(el);
    console.log(`\n   Image ${i + 1}:`);
    console.log('     src:', $el.attr('src'));
    console.log('     data-src:', $el.attr('data-src'));
    console.log('     data-srcset:', $el.attr('data-srcset'));
    console.log('     srcset:', $el.attr('srcset'));
    console.log('     class:', $el.attr('class'));
    console.log('     alt:', $el.attr('alt'));
  });

  console.log('\n2. Checking all img tags with product in data-src:');
  $('img').each((i, el) => {
    const $el = $(el);
    const dataSrc = $el.attr('data-src') || '';
    const dataSrcset = $el.attr('data-srcset') || '';

    if (dataSrc.includes('26182834') || dataSrcset.includes('26182834')) {
      console.log('\n   Found in data attributes:');
      console.log('     data-src:', dataSrc);
      console.log('     data-srcset:', dataSrcset);
      console.log('     alt:', $el.attr('alt'));
    }
  });

  console.log('\n3. Extracting all product images from swiper-slide:');
  const productImages = [];
  $('.swiper-slide img').each((i, el) => {
    const $el = $(el);
    let src = $el.attr('data-src') || $el.attr('data-srcset') || $el.attr('src');

    // Skip placeholders
    if (src && !src.includes('data:image') && !src.includes('blank.gif')) {
      // Get the highest quality from srcset if available
      if (src.includes(',')) {
        const srcsetParts = src.split(',').map(s => s.trim());
        // Get the last (usually highest quality)
        src = srcsetParts[srcsetParts.length - 1].split(' ')[0];
      }

      if (!productImages.includes(src)) {
        productImages.push(src);
      }
    }
  });

  console.log('\n   Total unique product images found:', productImages.length);
  productImages.forEach((img, idx) => {
    console.log(`     ${idx + 1}. ${img}`);
  });
}

testClarks().catch(console.error);
