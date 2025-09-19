// Quick test to see the page structure
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function quickTest() {
  const url = 'https://chiclara.com/products/oversized-sweater-with-contrast-stitching?variant=44936391393455';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));

  // Extract all product data
  const productData = await page.evaluate(() => {
    const result = {
      shopifyProduct: null,
      images: [],
      sizes: [],
      colors: [],
      selectors: {}
    };

    // Look for Shopify product
    if (window.product) {
      result.shopifyProduct = window.product;
    }

    // Find images
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.dataset.src;
      if (src && src.includes('cdn.shop') && !src.includes('icon') && !src.includes('logo')) {
        result.images.push(src);
      }
    });

    // Find size options
    document.querySelectorAll('input[name*="Size"], select[name*="Size"] option, [data-option-name="Size"] label, .product-form__input--size label, fieldset[data-option-name="Size"] input + label').forEach(elem => {
      const text = elem.textContent?.trim();
      if (text) result.sizes.push(text);
    });

    // Find color options
    document.querySelectorAll('input[name*="Color"], select[name*="Color"] option, [data-option-name="Color"] label, .product-form__input--color label, fieldset[data-option-name="Color"] input + label').forEach(elem => {
      const text = elem.textContent?.trim();
      if (text) result.colors.push(text);
    });

    // Check for various selectors
    result.selectors = {
      hasProductJson: !!document.querySelector('[data-product-json]'),
      hasProductForm: !!document.querySelector('form[data-product-form], .product-form'),
      hasVariantRadios: !!document.querySelector('fieldset input[type="radio"]'),
      hasSwatchImages: !!document.querySelector('.product__media img, .product-images img, [class*="gallery"] img'),
      fieldsets: Array.from(document.querySelectorAll('fieldset')).map(f => ({
        name: f.dataset.optionName || f.querySelector('legend')?.textContent || 'Unknown',
        options: Array.from(f.querySelectorAll('input + label')).map(l => l.textContent.trim())
      }))
    };

    return result;
  });

  console.log('Product Data:', JSON.stringify(productData, null, 2));

  await browser.close();
}

quickTest().catch(console.error);