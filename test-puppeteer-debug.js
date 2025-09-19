const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function debugPuppeteer() {
  const url = 'https://www.cos.com/en-usd/men/shirts/product.short-sleeved-linen-shirt-brown.1216632001.html';

  console.log(`\n🔍 Debugging Puppeteer fetch for: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('⏳ Navigating to page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('✅ Page loaded\n');

    // Wait for product content
    console.log('⏳ Waiting for product elements...');
    try {
      await page.waitForSelector('.product-detail-main', { timeout: 5000 });
      console.log('✅ Product content found');
    } catch (e) {
      console.log('⚠️  Product detail not found, continuing...');
    }

    // Get page title
    const title = await page.title();
    console.log(`\n📄 Page title: "${title}"`);

    // Check for specific elements
    const elements = await page.evaluate(() => {
      const checks = {};

      // Check various selectors
      const selectors = {
        'h1': document.querySelector('h1')?.innerText,
        '.product-item-headline': document.querySelector('.product-item-headline')?.innerText,
        '.ProductName': document.querySelector('.ProductName')?.innerText,
        '.product-detail-description h1': document.querySelector('.product-detail-description h1')?.innerText,
        '.price': document.querySelector('.price')?.innerText,
        '.ProductPrice': document.querySelector('.ProductPrice')?.innerText,
        '.product-item-price': document.querySelector('.product-item-price')?.innerText,
        'img count': document.querySelectorAll('img').length,
        '.product-detail-images img': document.querySelectorAll('.product-detail-images img').length,
        '.slick-slide img': document.querySelectorAll('.slick-slide img').length
      };

      for (const [key, value] of Object.entries(selectors)) {
        checks[key] = value || 'not found';
      }

      // Get all h1 elements
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.innerText);
      checks.allH1s = h1s;

      // Get all elements with "product" in class
      const productElements = Array.from(document.querySelectorAll('[class*="product"]')).map(el => el.className);
      checks.productClasses = productElements.slice(0, 10);

      return checks;
    });

    console.log('\n🔎 Element checks:');
    for (const [key, value] of Object.entries(elements)) {
      if (Array.isArray(value)) {
        console.log(`  ${key}:`, value);
      } else {
        console.log(`  ${key}: "${value}"`);
      }
    }

    // Get full HTML for analysis
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log(`\n📊 HTML stats:`);
    console.log(`  Total length: ${html.length} characters`);
    console.log(`  Images found: ${$('img').length}`);
    console.log(`  Scripts: ${$('script').length}`);
    console.log(`  Links: ${$('a').length}`);

    // Check for JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`  JSON-LD scripts: ${jsonLdScripts.length}`);

    if (jsonLdScripts.length > 0) {
      jsonLdScripts.each((i, elem) => {
        try {
          const data = JSON.parse($(elem).html());
          console.log(`\n  JSON-LD ${i + 1}:`, JSON.stringify(data, null, 2).substring(0, 500));
        } catch (e) {
          console.log(`  JSON-LD ${i + 1}: Parse error`);
        }
      });
    }

    // Save HTML for inspection
    const fs = require('fs').promises;
    await fs.writeFile('debug-cos-page.html', html);
    console.log('\n💾 HTML saved to debug-cos-page.html for inspection');

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n✅ Debug complete\n');
}

debugPuppeteer().catch(console.error);