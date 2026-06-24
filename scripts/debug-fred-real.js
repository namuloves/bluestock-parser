const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,  // Show browser to see what's actually happening
    devtools: true
  });
  const page = await browser.newPage();

  console.log('Opening fredhome URL...');
  await page.goto('https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log('Page loaded. Waiting for hydration...');
  await new Promise(r => setTimeout(r, 5000));

  // Get ALL the text content from price-related elements
  const allContent = await page.evaluate(() => {
    const results = [];

    // Get the actual .product-price element
    const priceEl = document.querySelector('.product-price');
    if (priceEl) {
      results.push({
        selector: '.product-price',
        text: priceEl.textContent,
        innerHTML: priceEl.innerHTML.substring(0, 200)
      });
    }

    // Check for any element containing dollar sign
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent && el.textContent.includes('$') && !el.textContent.includes('font')) {
        const text = el.textContent.trim();
        if (text.length < 50 && text.match(/\$\d+/)) {
          results.push({
            selector: el.className || el.tagName,
            text: text
          });
        }
      }
    });

    // Check window.__NUXT__ data
    if (window.__NUXT__) {
      results.push({
        selector: 'NUXT_DATA',
        text: JSON.stringify(window.__NUXT__).substring(0, 500)
      });
    }

    return results;
  });

  console.log('\n=== All price-related content ===');
  allContent.forEach(item => {
    console.log(`\n${item.selector}:`);
    console.log(`  Text: "${item.text}"`);
    if (item.innerHTML) {
      console.log(`  HTML: "${item.innerHTML}"`);
    }
  });

  // Take a screenshot
  await page.screenshot({ path: 'fred-actual.png', fullPage: false });
  console.log('\nScreenshot saved as fred-actual.png');

  console.log('\nKeeping browser open for 30 seconds so you can inspect...');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
})();