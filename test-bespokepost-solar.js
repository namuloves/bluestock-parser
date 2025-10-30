const axios = require('axios');
const cheerio = require('cheerio');

async function testBespokePost() {
  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('🔍 Testing Bespoke Post Solar Panel URL...\n');

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Test different selectors
    console.log('=== PRODUCT NAME ===');
    const name1 = $('h1[data-test="product-name"]').text().trim();
    const name2 = $('h1.product-name').text().trim();
    const name3 = $('h1').first().text().trim();
    const name4 = $('[itemProp="name"]').text().trim();
    console.log('data-test="product-name":', name1 || '❌ NOT FOUND');
    console.log('h1.product-name:', name2 || '❌ NOT FOUND');
    console.log('h1 (first):', name3 || '❌ NOT FOUND');
    console.log('itemProp="name":', name4 || '❌ NOT FOUND');

    console.log('\n=== PRICE ===');
    const price1 = $('[data-test="product-price"]').text().trim();
    const price2 = $('.price').text().trim();
    const price3 = $('[itemProp="price"]').attr('content');
    const price4 = $('span[data-testid="price"]').text().trim();
    console.log('data-test="product-price":', price1 || '❌ NOT FOUND');
    console.log('.price:', price2 || '❌ NOT FOUND');
    console.log('itemProp="price":', price3 || '❌ NOT FOUND');
    console.log('data-testid="price":', price4 || '❌ NOT FOUND');

    console.log('\n=== IMAGES ===');
    const images1 = $('img[data-test="product-image"]').map((i, el) => $(el).attr('src')).get();
    const images2 = $('.product-image img').map((i, el) => $(el).attr('src')).get();
    const images3 = $('[itemProp="image"]').map((i, el) => $(el).attr('src') || $(el).attr('content')).get();
    console.log('data-test="product-image" count:', images1.length);
    console.log('Sample:', images1[0] || '❌ NOT FOUND');
    console.log('.product-image img count:', images2.length);
    console.log('itemProp="image" count:', images3.length);

    console.log('\n=== DESCRIPTION ===');
    const desc1 = $('[data-test="product-description"]').text().trim().substring(0, 100);
    const desc2 = $('.product-description').text().trim().substring(0, 100);
    const desc3 = $('[itemProp="description"]').text().trim().substring(0, 100);
    console.log('data-test="product-description":', desc1 || '❌ NOT FOUND');
    console.log('.product-description:', desc2 || '❌ NOT FOUND');
    console.log('itemProp="description":', desc3 || '❌ NOT FOUND');

    // Check for JSON-LD
    console.log('\n=== JSON-LD ===');
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        console.log('Found JSON-LD:', data['@type']);
        console.log('Name:', data.name);
        console.log('Price:', data.offers?.price);
        console.log('Images:', data.image?.length || 0);
      } catch (e) {
        console.log('JSON-LD parse error:', e.message);
      }
    } else {
      console.log('❌ No JSON-LD found');
    }

    // Check for Next.js data
    console.log('\n=== NEXT.JS DATA ===');
    const nextData = $('#__NEXT_DATA__').html();
    if (nextData) {
      try {
        const data = JSON.parse(nextData);
        console.log('Found __NEXT_DATA__');
        console.log('Props keys:', Object.keys(data.props || {}).join(', '));

        // Try to find product data in Next.js props
        const propsStr = JSON.stringify(data.props).substring(0, 500);
        console.log('Props preview:', propsStr);
      } catch (e) {
        console.log('Next.js data parse error:', e.message);
      }
    } else {
      console.log('❌ No __NEXT_DATA__ found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBespokePost();
