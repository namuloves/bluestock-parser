const axios = require('axios');
const cheerio = require('cheerio');

async function quickTest() {
  const url = 'https://www.miumiu.com/us/en/p/new-balance-x-miu-miu-530-sl-suede-and-mesh-sneakers/5E165E_3D8C_F0009_F_BD05';
  console.log('Testing Miu Miu:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    const $ = cheerio.load(response.data);
    console.log('HTML received:', response.data.length, 'bytes');

    // Check for price
    const selectors = ['.price', '[itemprop="price"]', '.product-price', '[data-price]'];
    selectors.forEach(s => {
      const text = $(s).first().text();
      if (text) console.log(`Found ${s}: ${text}`);
    });

    // Check JSON-LD
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        if (data.offers?.price) {
          console.log('Price in JSON-LD:', data.offers.price);
        }
      } catch(e) {}
    });

  } catch(error) {
    console.log('Error:', error.message);
  }
}

quickTest();
