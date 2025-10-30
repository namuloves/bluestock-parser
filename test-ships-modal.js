const axios = require('axios');
const cheerio = require('cheerio');

async function testShips() {
  const url = 'https://www.shipsltd.co.jp/pages/sp_50th_anniversary_items.aspx#modal-60';

  console.log('🔍 Fetching SHIPS page...');
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const html = response.data;
  const $ = cheerio.load(html);

  console.log('\n📊 Page Analysis:');
  console.log('Title:', $('title').text());

  console.log('\n🔍 Looking for modal content...');

  // Check for modal elements
  const modals = $('[id*="modal"]');
  console.log('Modal elements found:', modals.length);

  modals.each((i, el) => {
    const id = $(el).attr('id');
    const classes = $(el).attr('class');
    console.log(`\n  Modal ${i + 1}:`);
    console.log('    ID:', id);
    console.log('    Classes:', classes);
    console.log('    Text preview:', $(el).text().substring(0, 100).trim());
  });

  // Look for modal-60 specifically
  console.log('\n🎯 Looking for modal-60...');
  const modal60 = $('#modal-60, [id="modal-60"]');
  if (modal60.length > 0) {
    console.log('✅ Found modal-60!');
    console.log('HTML structure:', modal60.html()?.substring(0, 500));

    // Look for product info in modal
    const productName = modal60.find('.product-name, .name, h2, h3').first().text().trim();
    const price = modal60.find('.price, [class*="price"]').first().text().trim();
    const images = [];
    modal60.find('img').each((i, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src) images.push(src);
    });

    console.log('\nProduct data in modal:');
    console.log('  Name:', productName);
    console.log('  Price:', price);
    console.log('  Images:', images.length);
    images.forEach((img, idx) => console.log(`    ${idx + 1}. ${img.substring(0, 100)}`));
  } else {
    console.log('❌ Modal-60 not found');
  }

  // Check for JSON data
  console.log('\n📦 Looking for embedded JSON data...');
  $('script[type="application/json"], script[type="application/ld+json"]').each((i, el) => {
    const content = $(el).html();
    if (content && content.includes('modal-60') || content.includes('upper hights')) {
      console.log(`\n  Script ${i + 1} (relevant):`, content.substring(0, 300));
    }
  });

  // Check for product data in regular scripts
  console.log('\n🔍 Searching for product data in scripts...');
  $('script:not([src])').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('37400') || content.includes('37,400') || content.includes('¥37')) {
      console.log(`\n  Found price reference in script ${i + 1}:`);
      const lines = content.split('\n').filter(line =>
        line.includes('37400') || line.includes('price') || line.includes('product')
      );
      lines.slice(0, 5).forEach(line => console.log('    ', line.trim().substring(0, 150)));
    }
  });
}

testShips().catch(console.error);
