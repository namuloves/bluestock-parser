const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFWRD() {
  const url = 'https://www.fwrd.com/product-bode-spirit-sweater-in-blue/BOFE-MK12/?d=Mens';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Loading page...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for content
  await new Promise(r => setTimeout(r, 5000));

  // Debug page structure
  const pageData = await page.evaluate(() => {
    const debug = {
      title: document.title,
      h1: document.querySelector('h1')?.innerText,
      priceSelectors: {},
      sizeSelectors: {},
      foundElements: []
    };

    // Check various price selectors
    const priceTests = [
      '.price__current',
      '.price-current',
      '.product-price',
      '[data-testid="product-price"]',
      'span[class*="price"]',
      'div[class*="price"]',
      '.product-info__price',
      '[class*="ProductPrice"]'
    ];

    priceTests.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) {
        debug.priceSelectors[selector] = el.innerText.substring(0, 50);
        debug.foundElements.push(`Price: ${selector}`);
      }
    });

    // Check size selectors
    const sizeTests = [
      'button[data-testid*="size"]',
      '.size-button',
      '[class*="SizeSelector"] button',
      'button[class*="size"]',
      '[data-size]',
      '.product-sizes button'
    ];

    sizeTests.forEach(selector => {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        debug.sizeSelectors[selector] = Array.from(els).slice(0, 3).map(e => e.innerText);
        debug.foundElements.push(`Sizes: ${selector} (${els.length} found)`);
      }
    });

    // Look for any element with price-like content
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const text = el.innerText;
      if (text && text.match(/\$\d+/) && !el.querySelector('*')) {
        const classes = el.className || 'no-class';
        if (!debug.priceSelectors[classes]) {
          debug.priceSelectors[classes] = text.substring(0, 50);
        }
      }
    });

    return debug;
  });

  console.log('Debug Data:', JSON.stringify(pageData, null, 2));

  await browser.close();
}

debugFWRD().catch(console.error);