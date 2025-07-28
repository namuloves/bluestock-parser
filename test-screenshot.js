const puppeteer = require('puppeteer');

async function test() {
  console.log('Testing screenshot capability...');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('Going to google.com...');
    
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
    console.log('Page loaded');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({
      encoding: 'base64',
      type: 'jpeg',
      quality: 80
    });
    
    console.log('Screenshot taken, size:', screenshot.length);
    
    // Save to file too
    await page.screenshot({ path: 'test-screenshot.jpg' });
    console.log('Screenshot saved to test-screenshot.jpg');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

test();