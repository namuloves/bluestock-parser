/**
 * Our Legacy Scraper (Puppeteer-based)
 *
 * Handles Our Legacy products with JavaScript-rendered prices
 * Uses Puppeteer to capture USD prices shown to US visitors
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeOurLegacy(url) {
  let browser;

  try {
    console.log('🔄 Attempting Our Legacy Puppeteer scraper...');

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();

    // Set US location to get USD prices
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9'
    });
    await page.emulateTimezone('America/New_York');
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('📄 Navigating to Our Legacy page...');
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Response status:', response.status());

    if (response.status() === 403 || response.status() === 404) {
      throw new Error(`Page returned status ${response.status()}`);
    }

    // Wait for the page to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Wait for JavaScript to render the price (give it time to detect location and update)
    console.log('⏳ Waiting for JavaScript to render USD price...');
    await page.waitForSelector('[data-testid="price"], [data-testid="product-price"], .price, h2', { timeout: 15000 }).catch(() => null);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract product data after JavaScript has run
    const result = await page.evaluate(() => {
      const data = {};

      // Extract name
      const nameElement = document.querySelector('h1, [data-testid="product-title"], .product-title');
      if (nameElement) {
        data.name = nameElement.textContent.trim();
      }

      // Extract rendered price (should be USD for US visitors)
      const priceElement = document.querySelector('[data-testid="price"], [data-testid="product-price"], .price, h2');
      if (priceElement) {
        const priceText = priceElement.textContent.trim();
        data.price_text = priceText;

        // Extract numeric price
        const priceMatch = priceText.match(/(\d+(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/);
        if (priceMatch) {
          data.price = parseFloat(priceMatch[1].replace(/,/g, ''));
        }

        // Extract currency
        if (priceText.includes('USD') || priceText.includes('$')) {
          data.currency = 'USD';
          data.currency_source = 'displayed';
        }
      }

      // Extract images
      const images = [];
      document.querySelectorAll('img[src*="centracdn"]').forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && src.includes('centracdn.net') && !images.includes(src)) {
          // Get high-res version
          const highRes = src.replace(/-small|-medium/, '-big');
          images.push(highRes);
        }
      });
      data.images = images.slice(0, 5);

      // Extract description from JSON-LD or page
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent);
          if (jsonLd.description && !data.description) {
            data.description = jsonLd.description;
          }
          if (jsonLd.brand && jsonLd.brand.name) {
            data.brand = jsonLd.brand.name;
          }
          if (jsonLd.sku) {
            data.sku = jsonLd.sku;
          }
          if (jsonLd.offers) {
            if (!data.currency && jsonLd.offers.priceCurrency) {
              data.currency = jsonLd.offers.priceCurrency;
              data.currency_source = 'jsonld';
            }
            if (!data.price && jsonLd.offers.price) {
              const jsonLdPrice = parseFloat(String(jsonLd.offers.price).replace(/,/g, ''));
              if (!Number.isNaN(jsonLdPrice)) {
                data.price = jsonLdPrice;
                data.price_text = data.price_text || `${jsonLdPrice} ${jsonLd.offers.priceCurrency || ''}`.trim();
              }
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e.message);
        }
      }

      // Meta fallbacks for currency/description
      if (!data.currency) {
        const currencyMeta = document.querySelector('meta[property="product:price:currency"], meta[itemprop="priceCurrency"]');
        if (currencyMeta?.content) {
          data.currency = currencyMeta.content.trim();
          data.currency_source = data.currency_source || 'meta';
        }
      }

      if (!data.description) {
        const descriptionMeta = document.querySelector('meta[name="description"]');
        if (descriptionMeta?.content) {
          data.description = descriptionMeta.content.trim();
        }
      }

      // Extract material from description
      const descElement = document.querySelector('[data-testid="description"], .description');
      if (descElement) {
        const descText = descElement.textContent;

        // Extract materials like "100% Cotton"
        const materialMatch = descText.match(/\d+%\s+\w+/g);
        if (materialMatch) {
          data.materials = materialMatch;
        }
      }

      return data;
    });

    console.log('✅ Successfully scraped Our Legacy product');
    console.log('Price extracted:', result.price_text);
    console.log('Currency:', result.currency);
    console.log('Images found:', result.images?.length || 0);

    await browser.close();

    return {
      success: true,
      product: result,
      scraper: 'ourlegacy-puppeteer'
    };

  } catch (error) {
    console.error('❌ Our Legacy Puppeteer scraper failed:', error.message);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = scrapeOurLegacy;
