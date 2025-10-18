const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugGalleryDept() {
  const url = 'https://gallerydept.com/collections/mens/products/painted-carpenter-flare-natural';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Loading page...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const pageData = await page.evaluate(() => {
    const debug = {
      isShopify: false,
      productData: null,
      sizes: [],
      sizeSelectors: {},
      images: [],
      scripts: []
    };

    // Check if it's Shopify
    debug.isShopify = !!window.Shopify || !!document.querySelector('[data-shopify-feature]');

    // Look for Shopify product data
    if (window.product) {
      debug.productData = {
        title: window.product.title,
        variants: window.product.variants?.slice(0, 3)
      };
    }

    // Look for size selectors
    const sizeTests = [
      'input[type="radio"][name*="Size"] + label',
      'select[name*="Size"] option',
      'button[data-size]',
      '[class*="size"] button',
      '[class*="variant"] input + label',
      '.product-form__input input[type="radio"] + label',
      'fieldset input[type="radio"] + label'
    ];

    sizeTests.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        debug.sizeSelectors[selector] = Array.from(elements).map(el => ({
          text: el.textContent?.trim(),
          value: el.getAttribute('for') || el.value
        }));
      }
    });

    // Look for images
    document.querySelectorAll('.product__media img, .product-single__photo img, [class*="gallery"] img').forEach(img => {
      const src = img.src || img.dataset.src;
      if (src && !src.includes('icon') && !src.includes('logo')) {
        debug.images.push(src);
      }
    });

    // Check scripts for product data
    document.querySelectorAll('script').forEach(script => {
      const content = script.textContent;
      if (content && content.includes('product') && content.includes('variants')) {
        const snippet = content.substring(0, 200);
        debug.scripts.push(snippet);
      }
    });

    // Look for any fieldsets (often contain variants)
    const fieldsets = document.querySelectorAll('fieldset');
    fieldsets.forEach(fs => {
      const legend = fs.querySelector('legend')?.textContent;
      if (legend) {
        const inputs = fs.querySelectorAll('input[type="radio"] + label');
        if (inputs.length > 0) {
          debug.sizeSelectors[`Fieldset: ${legend}`] = Array.from(inputs).map(el => el.textContent.trim());
        }
      }
    });

    return debug;
  });

  console.log('Debug Data:', JSON.stringify(pageData, null, 2));

  await browser.close();
}

debugGalleryDept().catch(console.error);