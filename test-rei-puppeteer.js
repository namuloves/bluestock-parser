const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin with all evasions
puppeteer.use(StealthPlugin());

async function testREI() {
  console.log('Testing REI.com bot protection...\n');

  const browser = await puppeteer.launch({
    headless: false, // Run in headed mode to see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // Override navigator properties to appear more human
    await page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override navigator.plugins to appear non-empty
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    console.log('Navigating to REI product page...');

    // Monitor network responses
    page.on('response', response => {
      const status = response.status();
      const url = response.url();

      if (url.includes('rei.com/product')) {
        console.log(`Response: ${status} - ${url.substring(0, 100)}`);
      }

      if (status === 403 || status === 429) {
        console.log(`\n⚠️  Blocked with status ${status}`);
      }
    });

    // Navigate to the page
    const response = await page.goto(
      'https://www.rei.com/product/249793/on-on-x-beams-x-rei-co-op-cloudrock-low-waterproof-hiking-shoes-mens',
      {
        waitUntil: 'networkidle2',
        timeout: 30000
      }
    );

    console.log(`\nPage loaded with status: ${response.status()}`);
    console.log(`URL: ${page.url()}`);

    // Wait a bit to see if we get redirected
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for bot detection indicators
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check for Cloudflare or other bot detection
    const pageContent = await page.content();

    if (pageContent.includes('Cloudflare') || pageContent.includes('cf-browser-verification')) {
      console.log('\n🔒 Cloudflare protection detected');
    }

    if (pageContent.includes('Access Denied') || pageContent.includes('403 Forbidden')) {
      console.log('\n🚫 Access denied - bot detection triggered');
    }

    // Try to find product data
    const productData = await page.evaluate(() => {
      const data = {};

      // Look for product title
      const titleElement = document.querySelector('h1') ||
                          document.querySelector('[data-ui="product-title"]') ||
                          document.querySelector('.product-title');
      data.title = titleElement ? titleElement.textContent.trim() : null;

      // Look for price
      const priceElement = document.querySelector('[data-ui="product-price"]') ||
                          document.querySelector('.price-value') ||
                          document.querySelector('[class*="price"]');
      data.price = priceElement ? priceElement.textContent.trim() : null;

      // Check for any bot detection messages
      const bodyText = document.body.textContent;
      data.hasAccessDenied = bodyText.includes('Access Denied');
      data.hasCloudflare = bodyText.includes('Cloudflare');
      data.hasRateLimiting = bodyText.includes('rate limit');

      return data;
    });

    console.log('\nExtracted data:', productData);

    // Save screenshot for debugging
    await page.screenshot({ path: 'rei-test.png', fullPage: false });
    console.log('\nScreenshot saved as rei-test.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testREI().then(() => {
  console.log('\nTest complete!');
}).catch(console.error);