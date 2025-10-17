/**
 * Test script to render fredhome.com.au with Puppeteer and extract the actual data
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const url = 'https://fredhome.com.au/products/the-baguette-bag?variant=49833831072066';

async function testFredhomeWithRendering() {
  console.log('🚀 Launching Puppeteer to render fredhome...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('📄 Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the page to fully render
    console.log('⏳ Waiting for content to load...');
    await new Promise(r => setTimeout(r, 3000));

    // Try to find product data
    const productData = await page.evaluate(() => {
      const data = {
        title: null,
        price: null,
        images: [],
        debug: {}
      };

      // Look for title
      const titleSelectors = [
        '.product-title',
        '.product-heading h1',
        'h1.title',
        'h1',
        '[data-product-title]'
      ];

      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          data.title = el.textContent.trim();
          data.debug.titleSelector = selector;
          break;
        }
      }

      // Look for all text containing prices
      const allTexts = Array.from(document.querySelectorAll('*')).map(el => el.textContent).filter(text => text && text.includes('$'));
      data.debug.allPrices = [...new Set(allTexts.filter(t => t.match(/\$\d+/)).slice(0, 10))];

      // Look for price with more specific selectors
      const priceSelectors = [
        '.product-price',
        '[data-product-price]',
        '.price',
        '.money',
        'span:contains("$")',
        'p:contains("$")'
      ];

      for (const selector of priceSelectors) {
        try {
          const els = document.querySelectorAll(selector);
          for (const el of els) {
            if (el.textContent.includes('$')) {
              data.price = el.textContent.trim();
              data.debug.priceSelector = selector;
              break;
            }
          }
          if (data.price) break;
        } catch (e) {}
      }

      // Look for all images
      const allImages = Array.from(document.querySelectorAll('img'));
      data.debug.totalImages = allImages.length;

      // Filter for product images (not logos, icons, etc)
      allImages.forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('Social')) {
          data.images.push({
            src: src,
            alt: img.alt,
            width: img.width,
            height: img.height,
            parent: img.parentElement?.className
          });
        }
      });

      // Check for Nuxt data
      if (window.__NUXT__) {
        data.debug.hasNuxtData = true;
      }

      // Look for product data in scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      scripts.forEach(script => {
        if (script.textContent && script.textContent.includes('product')) {
          if (script.textContent.includes('"price"')) {
            data.debug.hasProductScript = true;
          }
        }
      });

      return data;
    });

    console.log('\n📦 EXTRACTED DATA:');
    console.log('Title:', productData.title || 'NOT FOUND');
    console.log('Price:', productData.price || 'NOT FOUND');
    console.log('Images found:', productData.images.length);

    console.log('\n🔍 DEBUG INFO:');
    console.log('Title selector used:', productData.debug.titleSelector || 'none');
    console.log('Price selector used:', productData.debug.priceSelector || 'none');
    console.log('Total images on page:', productData.debug.totalImages);
    console.log('Has Nuxt data:', productData.debug.hasNuxtData);
    console.log('Has product script:', productData.debug.hasProductScript);

    console.log('\n💰 ALL PRICES FOUND ON PAGE:');
    productData.debug.allPrices?.forEach(price => console.log('  -', price));

    console.log('\n🖼️ PRODUCT IMAGES:');
    productData.images.slice(0, 5).forEach((img, i) => {
      console.log(`  [${i}] ${img.alt || 'no-alt'}`);
      console.log(`      ${img.src.substring(0, 80)}...`);
      console.log(`      Size: ${img.width}x${img.height}, Parent: ${img.parent}`);
    });

    // Take a screenshot
    await page.screenshot({ path: 'fredhome-rendered.png', fullPage: false });
    console.log('\n📸 Screenshot saved as fredhome-rendered.png');

    // Save the rendered HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('fredhome-rendered.html', html);
    console.log('💾 Rendered HTML saved as fredhome-rendered.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testFredhomeWithRendering().catch(console.error);