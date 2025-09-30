const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin
puppeteer.use(StealthPlugin());

async function testFWRDPage() {
  const url = 'https://www.fwrd.com/product-kartik-research-bomber-jacket-in-purple/KRCF-MO7/?d=Mens&utm_campaign=pinterest_performance_catalogsales&utm_medium=paidsocial&utm_source=pinterestpaid&utm_content=Pinterest+Performance%2B+Prospecting&pp=0';

  console.log('🎭 Testing FWRD page directly...');
  console.log('URL:', url);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('📄 Loading page...');
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Response status:', response.status());
    console.log('Response URL:', response.url());

    // Check for redirects or blocks
    const finalUrl = page.url();
    if (finalUrl !== url) {
      console.log('⚠️ Redirected to:', finalUrl);
    }

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check for product elements
    console.log('\n🔍 Checking for product elements...');

    const checks = {
      'h1': await page.$eval('h1', el => el.textContent.trim()).catch(() => 'NOT FOUND'),
      'product-title': await page.$eval('.product-title', el => el.textContent.trim()).catch(() => 'NOT FOUND'),
      'any h1/h2/h3': await page.$$eval('h1, h2, h3', els => els.slice(0, 3).map(el => el.textContent.trim())).catch(() => []),
      'price elements': await page.$$eval('[class*="price"]', els => els.slice(0, 5).map(el => ({
        class: el.className,
        text: el.textContent.trim()
      }))).catch(() => []),
      'brand elements': await page.$$eval('[class*="brand"], [class*="designer"]', els => els.slice(0, 3).map(el => ({
        class: el.className,
        text: el.textContent.trim()
      }))).catch(() => []),
      'image count': await page.$$eval('img', imgs => imgs.length).catch(() => 0),
      'fwrd images': await page.$$eval('img[src*="fwrdassets"]', imgs => imgs.length).catch(() => 0)
    };

    console.log('Product checks:', JSON.stringify(checks, null, 2));

    // Check for error messages or captcha
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    if (bodyText.toLowerCase().includes('captcha') || bodyText.toLowerCase().includes('verify') || bodyText.toLowerCase().includes('blocked')) {
      console.log('⚠️ Possible bot detection:', bodyText.substring(0, 200));
    }

    // Try to extract product data
    console.log('\n📦 Attempting to extract product data...');
    const productData = await page.evaluate(() => {
      const data = {};

      // Try various selectors
      data.h1 = document.querySelector('h1')?.textContent?.trim();
      data.productName = document.querySelector('[class*="ProductName"]')?.textContent?.trim();
      data.productTitle = document.querySelector('[class*="product-title"]')?.textContent?.trim();

      // Price selectors
      const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"]');
      data.prices = Array.from(priceElements).slice(0, 3).map(el => ({
        class: el.className,
        text: el.textContent.trim()
      }));

      // Check for specific FWRD elements
      data.pdpContent = document.querySelector('.pdp-content') ? 'EXISTS' : 'NOT FOUND';
      data.productInfo = document.querySelector('.product-info') ? 'EXISTS' : 'NOT FOUND';

      // Check for tabs
      data.tabs = Array.from(document.querySelectorAll('[class*="tabs"] [class*="link"], [class*="Tab"]')).map(el => el.textContent.trim());

      // Check meta tags
      data.ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      data.ogDescription = document.querySelector('meta[property="og:description"]')?.content;

      return data;
    });

    console.log('Extracted data:', JSON.stringify(productData, null, 2));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'fwrd-debug.png', fullPage: false });
    console.log('📸 Screenshot saved as fwrd-debug.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFWRDPage();