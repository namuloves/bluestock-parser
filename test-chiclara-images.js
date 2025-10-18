// Test to get product-specific images
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testImages() {
  const url = 'https://chiclara.com/products/oversized-sweater-with-contrast-stitching?variant=44936391393455';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));

  // Extract product-specific data
  const productData = await page.evaluate(() => {
    const result = {
      mainImage: null,
      thumbnails: [],
      variantOptions: [],
      productTitle: '',
      allScripts: []
    };

    // Get product title
    result.productTitle = document.querySelector('h1, .product__title')?.textContent?.trim();

    // Look for main product image
    const mainImg = document.querySelector('.product__media img, .product-photo-container img, .product-single__photo img, [data-product-featured-image]');
    if (mainImg) {
      result.mainImage = mainImg.src || mainImg.dataset.src;
    }

    // Look for thumbnails or gallery images
    document.querySelectorAll('.product__media-item img, .product-single__thumbnails img, [data-thumbnail-id] img, .slick-slide img').forEach(img => {
      const src = img.src || img.dataset.src;
      if (src && !src.includes('blank.gif')) {
        result.thumbnails.push(src);
      }
    });

    // Look for variant/option selectors
    document.querySelectorAll('select option, input[type="radio"] + label').forEach(elem => {
      const text = elem.textContent?.trim();
      if (text && text !== 'Title') {
        result.variantOptions.push(text);
      }
    });

    // Check all scripts for product data
    document.querySelectorAll('script').forEach(script => {
      const content = script.textContent;
      if (content && content.includes('product') && content.length < 5000) {
        // Look for product variable
        if (content.includes('var product') || content.includes('window.product')) {
          result.allScripts.push(content.substring(0, 500));
        }
      }
    });

    return result;
  });

  console.log('Product-specific Data:', JSON.stringify(productData, null, 2));

  await browser.close();
}

testImages().catch(console.error);