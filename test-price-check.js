const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  console.log('Navigating to fredhome URL with variant 49833831072066...');
  await page.goto('https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log('Waiting for page to fully load...');
  await new Promise(r => setTimeout(r, 3000));

  // Find all text containing numbers that could be prices
  const priceTexts = await page.evaluate(() => {
    const texts = [];
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      const text = el.textContent || '';
      // Look for 225 or 1080 specifically
      if (text.includes('225') || text.includes('1080')) {
        texts.push({
          text: text.substring(0, 200).replace(/\s+/g, ' ').trim(),
          tag: el.tagName,
          class: el.className || 'no-class',
          id: el.id || 'no-id'
        });
      }
    }
    return texts.slice(0, 10); // First 10 matches
  });

  console.log('\n=== Numbers 225 or 1080 found in page ===');
  priceTexts.forEach(t => {
    console.log(`\n[${t.tag}] class="${t.class}" id="${t.id}"`);
    console.log(`Text: "${t.text}"`);
  });

  // Check specific selectors
  console.log('\n=== Checking specific selectors ===');

  const selectors = [
    '.product-price',
    '.product-title',
    '[data-price]',
    '.price',
    'p:contains("$")',
    'span:contains("$")'
  ];

  for (const selector of selectors) {
    try {
      const text = await page.$eval(selector, el => el.textContent);
      console.log(`${selector}: "${text}"`);
    } catch (e) {
      console.log(`${selector}: NOT FOUND`);
    }
  }

  // Check meta tags
  console.log('\n=== Meta tags ===');
  const metaTags = await page.evaluate(() => {
    const metas = {};
    document.querySelectorAll('meta[property^="og:"], meta[property^="product:"]').forEach(meta => {
      metas[meta.getAttribute('property')] = meta.getAttribute('content');
    });
    return metas;
  });

  Object.entries(metaTags).forEach(([key, value]) => {
    if (value && (value.includes('price') || value.includes('225') || value.includes('1080'))) {
      console.log(`${key}: ${value}`);
    }
  });

  // Check JSON-LD
  console.log('\n=== JSON-LD data ===');
  const jsonLd = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const data = [];
    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        if (json.offers || json.price) {
          data.push(json);
        }
      } catch (e) {}
    });
    return data;
  });

  if (jsonLd.length > 0) {
    console.log(JSON.stringify(jsonLd, null, 2));
  } else {
    console.log('No JSON-LD with price data found');
  }

  await browser.close();
})();