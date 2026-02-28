/**
 * link-discoverer.js
 * Crawls a website to discover all product page URLs.
 * Uses Playwright for JS-heavy sites, Cheerio+axios for static ones.
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Playwright is optional — only load if available
let playwright = null;
try {
  playwright = require('playwright');
} catch (e) {
  // playwright not installed — will fall back to axios
}

// ── Heuristics for recognizing a product URL ─────────────────────────────────
const PRODUCT_URL_PATTERNS = [
  /\/product[s]?\//i,
  /\/p\//i,
  /\/item[s]?\//i,
  /\/shop\/.+/i,
  /\/dp\//i,           // Amazon
  /\/listing\//i,
  /\/collections\/.+\/products\/.+/i,  // Shopify: must have a product slug after /products/
  /^https?:\/\/[^/]+\/products\/[^/?]+/i, // Shopify: /products/<slug>
  /\-p\d{5,}/i,       // Zara: /shirt-p12345678.html
  /\-[a-z0-9]{6,}$/i, // slug endings common in fashion sites
  /\/[a-z0-9-]+-\d{5,}/i, // id in slug
];

// URLs we should never follow (also used to exclude from product URL set)
const COLLECTION_ONLY_PATTERN = /\/collections\/[^/]+\/?$/i; // /collections/socks — no /products/ after it

// URLs we should never follow
const SKIP_PATTERNS = [
  /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|pdf|zip)(\?.*)?$/i,
  /^mailto:/,
  /^tel:/,
  /^javascript:/,
  /\/cart/i,
  /\/checkout/i,
  /\/account/i,
  /\/login/i,
  /\/logout/i,
  /\/wishlist/i,
  /\/search\?/i,
  /\/cdn-cgi/i,
];

function isProductUrl(url) {
  if (COLLECTION_ONLY_PATTERN.test(url)) return false; // collection index pages are not products
  return PRODUCT_URL_PATTERNS.some(p => p.test(url));
}

function shouldSkip(url) {
  return SKIP_PATTERNS.some(p => p.test(url));
}

function normalizeUrl(href, baseUrl) {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(href, base);
    // Only follow same-domain links
    if (resolved.hostname !== base.hostname) return null;
    // Strip hash, variant param, and trailing slash for dedup
    resolved.hash = '';
    resolved.searchParams.delete('variant');
    let str = resolved.toString();
    if (str.endsWith('/') && str !== resolved.origin + '/') {
      str = str.slice(0, -1);
    }
    return str;
  } catch {
    return null;
  }
}

/**
 * Extract all links from raw HTML relative to baseUrl.
 */
function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const url = normalizeUrl(href, baseUrl);
    if (url && !shouldSkip(url)) links.add(url);
  });
  return [...links];
}

/**
 * Static crawl using axios + cheerio (fast, no JS rendering).
 */
async function staticFetch(url) {
  const resp = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });
  return resp.data;
}

/**
 * Dynamic crawl using Playwright (JS-rendered pages).
 */
async function dynamicFetch(url, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Main discoverer class.
 *
 * Usage:
 *   const d = new LinkDiscoverer({ startUrl, maxPages, useBrowser });
 *   const { productUrls, visitedCount } = await d.discover();
 */
class LinkDiscoverer {
  constructor(options = {}) {
    this.startUrl = options.startUrl;
    this.maxPages = options.maxPages || 200;        // max pages to crawl
    this.maxProducts = options.maxProducts || 5000; // stop early if we hit this
    this.useBrowser = options.useBrowser || false;  // set true for JS-heavy sites
    this.concurrency = options.concurrency || 3;
    this.delayMs = options.delayMs || 500;          // polite delay between requests
    this.onProgress = options.onProgress || null;   // callback(stats)
    this.stallAfter = options.stallAfter || 15;     // stop if no new products after N pages

    this.visited = new Set();
    this.queue = [];
    this.productUrls = new Set();
    this.errors = [];
    this.browser = null;
    this.stopped = false;
    this._pagesSinceNewProduct = 0;
  }

  async discover() {
    const origin = new URL(this.startUrl).origin;
    this.queue.push(this.startUrl);

    if (this.useBrowser && playwright) {
      this.browser = await playwright.chromium.launch({ headless: true });
    }

    try {
      while (
        this.queue.length > 0 &&
        this.visited.size < this.maxPages &&
        this.productUrls.size < this.maxProducts &&
        this._pagesSinceNewProduct < this.stallAfter &&
        !this.stopped
      ) {
        // Grab a batch up to concurrency limit
        const prevCount = this.productUrls.size;
        const batch = this.queue.splice(0, this.concurrency);
        await Promise.all(batch.map(url => this._processPage(url)));

        if (this.productUrls.size > prevCount) {
          this._pagesSinceNewProduct = 0;
        } else {
          this._pagesSinceNewProduct += batch.length;
        }

        if (this.onProgress) {
          this.onProgress({
            visited: this.visited.size,
            queued: this.queue.length,
            products: this.productUrls.size,
            errors: this.errors.length,
          });
        }

        if (this.delayMs > 0) {
          await new Promise(r => setTimeout(r, this.delayMs));
        }
      }
    } finally {
      if (this.browser) await this.browser.close();
    }

    return {
      productUrls: [...this.productUrls],
      visitedCount: this.visited.size,
      errors: this.errors,
    };
  }

  async _processPage(url) {
    if (this.visited.has(url)) return;
    this.visited.add(url);

    let html = '';
    try {
      if (this.useBrowser && this.browser) {
        html = await dynamicFetch(url, this.browser);
      } else {
        html = await staticFetch(url);
      }
    } catch (err) {
      this.errors.push({ url, error: err.message });
      return;
    }

    const links = extractLinks(html, url);

    for (const link of links) {
      if (isProductUrl(link)) {
        this.productUrls.add(link);
      }
      // Only queue non-product pages for further crawling (category/listing pages)
      if (!this.visited.has(link) && !isProductUrl(link) && !shouldSkip(link)) {
        this.queue.push(link);
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}

module.exports = { LinkDiscoverer, isProductUrl, extractLinks };
