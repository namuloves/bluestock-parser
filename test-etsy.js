const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin
puppeteer.use(StealthPlugin());

async function testEtsy() {
  console.log('Testing Etsy.com bot protection (DataDome)...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Override navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    console.log('Navigating to Etsy product page...');

    // Monitor responses
    page.on('response', response => {
      const status = response.status();
      const url = response.url();

      if (status === 403 || status === 429) {
        console.log(`⚠️  Blocked with status ${status} - ${url.substring(0, 80)}`);
      }

      if (url.includes('datadome')) {
        console.log(`🔒 DataDome detected: ${url.substring(0, 80)}`);
      }
    });

    // Navigate to the page
    const response = await page.goto(
      'https://www.etsy.com/listing/4359184424/upcycled-suede-palm-womans-felted-wool',
      {
        waitUntil: 'networkidle2',
        timeout: 30000
      }
    );

    console.log(`\nPage loaded with status: ${response.status()}`);
    console.log(`URL: ${page.url()}`);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check page title and content
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Try to extract product data
    const productData = await page.evaluate(() => {
      const data = {};

      // Look for product title
      const titleElement = document.querySelector('h1') ||
                          document.querySelector('[data-listing-title]') ||
                          document.querySelector('.listing-title');
      data.title = titleElement ? titleElement.textContent.trim() : null;

      // Look for price
      const priceElement = document.querySelector('[data-buy-box-region] [data-selector="price-only"]') ||
                          document.querySelector('.wt-text-title-larger') ||
                          document.querySelector('[data-price]') ||
                          document.querySelector('.price');
      data.price = priceElement ? priceElement.textContent.trim() : null;

      // Check for DataDome
      const bodyText = document.body.textContent;
      data.hasDataDome = bodyText.includes('DataDome') || bodyText.includes('datadome');
      data.isBlocked = bodyText.includes('blocked') || bodyText.includes('denied');

      // Check if we're on a captcha page
      data.hasCaptcha = !!document.querySelector('.g-recaptcha') ||
                        !!document.querySelector('[data-captcha]') ||
                        bodyText.includes('captcha');

      return data;
    });

    console.log('\nExtracted data:', productData);

    // Check if we got actual product data
    if (productData.title && productData.price) {
      console.log('✅ Successfully accessed product data!');
    } else if (productData.hasDataDome || productData.hasCaptcha) {
      console.log('🚫 Blocked by DataDome bot protection');
    }

    // Save screenshot
    await page.screenshot({ path: 'etsy-test.png', fullPage: false });
    console.log('\nScreenshot saved as etsy-test.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testEtsy().then(() => {
  console.log('\nTest complete!');
}).catch(console.error);