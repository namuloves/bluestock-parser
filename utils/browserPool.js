const puppeteer = require('puppeteer');

class BrowserPool {
  constructor(maxBrowsers = 2) {
    this.maxBrowsers = maxBrowsers;
    this.browsers = [];
    this.available = [];
    this.waitQueue = [];
  }

  async getBrowser() {
    // If we have an available browser, use it
    if (this.available.length > 0) {
      return this.available.pop();
    }

    // If we can create a new browser, do it
    if (this.browsers.length < this.maxBrowsers) {
      const browser = await this.createBrowser();
      this.browsers.push(browser);
      return browser;
    }

    // Otherwise, wait for one to become available
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  async createBrowser() {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
  }

  releaseBrowser(browser) {
    // If someone is waiting, give them the browser
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      resolve(browser);
    } else {
      // Otherwise, mark it as available
      this.available.push(browser);
    }
  }

  async closeAll() {
    await Promise.all(this.browsers.map(browser => browser.close()));
    this.browsers = [];
    this.available = [];
    this.waitQueue = [];
  }
}

// Create a singleton instance
const browserPool = new BrowserPool(process.env.MAX_BROWSERS || 2);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await browserPool.closeAll();
  process.exit(0);
});

module.exports = browserPool;