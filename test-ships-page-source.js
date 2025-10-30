const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeShipsPage() {
  const url = 'https://www.shipsltd.co.jp/pages/sp_50th_anniversary_items.aspx';

  console.log('🔍 Fetching SHIPS page...');
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'ja-JP,ja;q=0.9'
    }
  });

  const $ = cheerio.load(response.data);

  console.log('\n🎯 Looking for product links/modals...');

  // Look for any links or buttons that trigger modals
  const modalTriggers = $('[data-target*="modal"], [href*="#modal"], button[data-modal]');
  console.log('Modal triggers found:', modalTriggers.length);

  modalTriggers.slice(0, 10).each((i, el) => {
    console.log(`\n  Trigger ${i + 1}:`);
    console.log('    Tag:', el.name);
    console.log('    href:', $(el).attr('href'));
    console.log('    data-target:', $(el).attr('data-target'));
    console.log('    Text:', $(el).text().trim().substring(0, 50));
  });

  // Look for divs with modal IDs
  console.log('\n\n📦 Looking for hidden modal containers...');
  const modalContainers = $('div[id^="modal"], .modal');
  console.log('Modal containers found:', modalContainers.length);

  modalContainers.slice(0, 3).each((i, el) => {
    const $el = $(el);
    console.log(`\n  Container ${i + 1}:`);
    console.log('    ID:', $el.attr('id'));
    console.log('    Class:', $el.attr('class'));
    console.log('    Has product info:', $el.find('.price, [class*="price"]').length > 0);

    // Try to find product details
    const name = $el.find('h2, h3, .product-name, .name').first().text().trim();
    const price = $el.find('.price, [class*="price"], [class*="yen"]').first().text().trim();

    if (name || price) {
      console.log('    Product name:', name.substring(0, 100));
      console.log('    Price:', price);
    }
  });

  // Look for any data attributes with product info
  console.log('\n\n🔍 Checking for data attributes with product info...');
  $('[data-price], [data-product], [data-name]').slice(0, 5).each((i, el) => {
    console.log(`\n  Element ${i + 1}:`);
    console.log('    Tag:', el.name);
    console.log('    data-price:', $(el).attr('data-price'));
    console.log('    data-product:', $(el).attr('data-product'));
    console.log('    data-name:', $(el).attr('data-name'));
  });

  // Check if there are any JSON data islands
  console.log('\n\n📊 Looking for JavaScript data objects...');
  $('script:not([src])').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('products') && content.includes('modal')) {
      console.log(`\n  Script ${i + 1} contains products + modal:`);
      console.log(content.substring(0, 500));
    }
  });
}

analyzeShipsPage().catch(console.error);
