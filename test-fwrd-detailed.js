const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function detailedFWRDDebug() {
  const url = 'https://www.fwrd.com/product-bode-spirit-sweater-in-blue/BOFE-MK12/?d=Mens';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Loading page...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for content to load
  await new Promise(r => setTimeout(r, 5000));

  // Debug description and sizes
  const detailedData = await page.evaluate(() => {
    const debug = {
      description: {},
      sizes: {},
      allTexts: [],
      buttonInfo: []
    };

    // Look for description in various places
    const descriptionSelectors = [
      '[class*="description"]',
      '[class*="Description"]',
      '[class*="details"]',
      '[class*="Details"]',
      '[class*="product-info"]',
      '[data-testid*="description"]',
      '.product-details',
      '[itemprop="description"]',
      '[class*="ProductInfo"]',
      '[class*="productInfo"]'
    ];

    descriptionSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length > 50) {
          debug.description[selector] = text.substring(0, 200) + '...';
        }
      });
    });

    // Look for sizes more thoroughly
    const sizeSelectors = [
      'button[data-size]',
      'button[data-testid*="size"]',
      '[class*="SizeSelector"] button',
      '[class*="sizeSelector"] button',
      '[class*="size-selector"] button',
      '[class*="Size"] button',
      '[role="radio"][aria-label*="Size"]',
      'input[type="radio"][name*="size"] + label',
      '[class*="ProductSize"] button',
      'div[class*="size"] button'
    ];

    sizeSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        debug.sizes[selector] = Array.from(elements).map(el => ({
          text: el.innerText?.trim(),
          dataSize: el.getAttribute('data-size'),
          ariaLabel: el.getAttribute('aria-label'),
          disabled: el.disabled,
          className: el.className
        }));
      }
    });

    // Get all buttons on the page to see what's there
    document.querySelectorAll('button').forEach(btn => {
      const text = btn.innerText?.trim();
      if (text && !text.includes('Add to') && !text.includes('View')) {
        debug.buttonInfo.push({
          text: text.substring(0, 30),
          class: btn.className?.substring(0, 50),
          dataAttrs: Object.keys(btn.dataset)
        });
      }
    });

    // Look for any expandable sections (often contain details)
    const accordions = document.querySelectorAll('[class*="accordion"], [class*="Accordion"], [class*="expand"], [class*="Expand"], details');
    accordions.forEach(acc => {
      const header = acc.querySelector('summary, button, [class*="header"]')?.innerText;
      const content = acc.innerText?.substring(0, 200);
      if (header && content) {
        debug.description[`Accordion: ${header}`] = content;
      }
    });

    // Check for size dropdown/select
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
      const name = select.name || select.id || 'unknown';
      const options = Array.from(select.options).map(opt => opt.text);
      if (options.length > 0) {
        debug.sizes[`Select: ${name}`] = options;
      }
    });

    return debug;
  });

  console.log('Detailed Debug Data:', JSON.stringify(detailedData, null, 2));

  // Try clicking on expandable sections to reveal content
  console.log('\nTrying to expand sections...');

  const expandedContent = await page.evaluate(() => {
    const results = {};

    // Click on anything that looks like it might expand
    const expandables = document.querySelectorAll('button[class*="expand"], button[class*="accordion"], [class*="toggle"]');
    expandables.forEach((btn, index) => {
      try {
        btn.click();
        results[`Clicked_${index}`] = btn.innerText?.substring(0, 50);
      } catch (e) {}
    });

    return results;
  });

  console.log('Expanded:', expandedContent);

  // Wait a bit for content to appear
  await new Promise(r => setTimeout(r, 2000));

  // Re-check for description after expansion
  const afterExpansion = await page.evaluate(() => {
    const found = {};
    document.querySelectorAll('[class*="description"], [class*="details"], [class*="content"]').forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 50 && !text.includes('Size Guide')) {
        found[el.className?.substring(0, 50)] = text.substring(0, 200);
      }
    });
    return found;
  });

  console.log('\nAfter expansion:', afterExpansion);

  await browser.close();
}

detailedFWRDDebug().catch(console.error);