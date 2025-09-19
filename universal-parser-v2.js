const cheerio = require('cheerio');
const axios = require('axios');
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const { getProxyConfig, getAxiosConfig } = require('./config/proxy');

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());

class UniversalParserV2 {
  constructor() {
    this.browserInstance = null;
    this.cache = new Map();
    this.metrics = {
      attempts: 0,
      successes: 0,
      failures: 0,
      byStrategy: {
        direct: { attempts: 0, successes: 0 },
        puppeteer: { attempts: 0, successes: 0 }
      }
    };

    // Sites that require browser rendering
    this.requiresBrowser = new Set([
      'zara.com',
      'farfetch.com',
      'ssense.com',
      'net-a-porter.com',
      'cultgaia.com',
      'matchesfashion.com',
      'mytheresa.com',
      'wconcept.com',
      'aritzia.com',
      'revolve.com',
      'fwrd.com'
    ]);

    // Sites that block axios requests
    this.blocksDirectFetch = new Set([
      'cos.com',
      'arket.com',
      'stories.com',
      'hm.com',
      'www2.hm.com',
      'aritzia.com'
    ]);

    // Site-specific patterns based on actual HTML structure
    this.sitePatterns = {
      'zara.com': {
        name: ['h1.product-detail-info__header-name', '.product-name', '[data-qa-qualifier="product-name"]'],
        price: ['.price-current__amount', '.price__amount-current', '[data-qa-qualifier="product-price"]'],
        images: ['.media-image img', '.product-detail-images__image img', 'picture.media-image source'],
        brand: () => 'Zara'
      },
      'cos.com': {
        name: ['h1[itemprop="name"]', '.product-item-headline', 'h1.ProductName'],
        price: ['span[itemprop="price"]', '.product-item-price', '.ProductPrice'],
        images: ['.product-detail-main__images img', '.product-images img', '.slick-slide img'],
        brand: () => 'COS'
      },
      'hm.com': {
        name: ['h1.product-item-header', '.primary.product-item-headline', 'h1[data-test="product-name"]'],
        price: ['.price.parbase', 'span[data-test="product-price"]', '.ProductPrice-module--productItemPrice__3K5pF'],
        images: ['.product-detail-main-image-container img', '.product-detail-thumbnail-image'],
        brand: () => 'H&M'
      },
      'www2.hm.com': {
        name: ['h1.product-item-header', '.primary.product-item-headline', 'h1[data-test="product-name"]'],
        price: ['.price.parbase', 'span[data-test="product-price"]', '.ProductPrice-module--productItemPrice__3K5pF'],
        images: ['.product-detail-main-image-container img', '.product-detail-thumbnail-image'],
        brand: () => 'H&M'
      },
      'uniqlo.com': {
        name: ['h1.product-name', '.product-main-info h1', '[data-test="product-title"]'],
        price: ['.price-now', '.product-main-info__price', '[data-test="product-price-now"]'],
        images: ['.product-main-image img', '.product-image-carousel img', '.slick-slide img'],
        brand: () => 'Uniqlo'
      },
      'aritzia.com': {
        name: ['h1.product-name', '.pdp-product-name h1', '[data-test-id="product-name"]'],
        price: ['.product-price', '.pdp-product-price', '[data-test-id="product-price"]'],
        images: ['.product-image img', '.pdp-image img', '.product-images-carousel img'],
        brand: () => 'Aritzia'
      },
      'net-a-porter.com': {
        name: ['span.ProductDetails24__name', '.product-name'],
        price: ['.PriceWithSchema9__value', '.product-price'],
        images: ['.ProductImageCarousel__image img', '.product-image img'],
        brand: ['span.ProductDetails24__designer', '.product-designer']
      },
      'ssense.com': {
        name: ['h1.product-name', '.product-name-price h1'],
        price: ['.product-price', '.price-group span'],
        images: ['.product-images-container img', '.image-container img'],
        brand: ['.product-brand', '.product-name-price p']
      }
    };

    // Generic patterns as fallback
    this.genericPatterns = {
      name: [
        'h1',
        '.product-name',
        '.product-title',
        '[itemprop="name"]',
        '[data-testid="product-name"]',
        '.pdp-name',
        '.product-info h1'
      ],
      price: [
        '.price',
        '.product-price',
        '[itemprop="price"]',
        '.price-now',
        '.sale-price',
        '.current-price',
        '[data-testid="product-price"]',
        '.pdp-price',
        '.price-sales'
      ],
      images: [
        '.product-image img',
        '.product-photo img',
        '.gallery img',
        '.swiper-slide img',
        'picture img',
        '[data-testid="product-image"] img',
        '.pdp-image img',
        '.product-images img'
      ],
      brand: [
        '.brand',
        '.product-brand',
        '[itemprop="brand"]',
        '.designer',
        '.vendor',
        '.manufacturer'
      ]
    };

    this.logLevel = process.env.UNIVERSAL_LOG_LEVEL || 'normal';
  }

  getMetrics() {
    return this.metrics;
  }

  async getBrowser() {
    if (!this.browserInstance) {
      // Use puppeteer-extra with stealth plugin for better anti-detection
      this.browserInstance = await puppeteerExtra.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    }
    return this.browserInstance;
  }

  async parse(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    this.metrics.attempts++;

    if (this.logLevel !== 'quiet') {
      console.log(`\n🧠 Universal Parser V2 attempting: ${hostname}`);
    }

    // Check cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      if (this.logLevel === 'verbose') {
        console.log('📦 Returning cached result');
      }
      return cached.data;
    }

    try {
      let html;
      let strategy = 'direct';

      // Determine fetch strategy
      if (this.requiresBrowser.has(hostname) || this.blocksDirectFetch.has(hostname)) {
        strategy = 'puppeteer';
        html = await this.fetchWithPuppeteer(url);
      } else {
        // Try direct fetch first
        try {
          html = await this.fetchDirect(url);
          // Quick check if we got real content
          if (html.length < 5000 || !html.includes('product')) {
            if (this.logLevel === 'verbose') {
              console.log('⚠️  Minimal HTML received, trying Puppeteer');
            }
            strategy = 'puppeteer';
            html = await this.fetchWithPuppeteer(url);
          }
        } catch (error) {
          if (error.response?.status === 403 || error.response?.status === 429) {
            if (this.logLevel === 'verbose') {
              console.log(`⚠️  ${error.response.status} error, trying Puppeteer`);
            }
            strategy = 'puppeteer';
            html = await this.fetchWithPuppeteer(url);
          } else {
            throw error;
          }
        }
      }

      this.metrics.byStrategy[strategy].attempts++;

      // Parse HTML
      const $ = cheerio.load(html);
      const result = await this.extractData($, hostname, url);

      if (result.confidence > 0.5) {
        this.metrics.successes++;
        this.metrics.byStrategy[strategy].successes++;

        // Cache successful results
        this.cache.set(url, {
          data: result,
          timestamp: Date.now()
        });
      } else {
        this.metrics.failures++;
      }

      if (this.logLevel === 'verbose') {
        console.log('📊 Extraction result:', {
          strategy,
          confidence: result.confidence,
          hasName: !!result.name,
          hasPrice: !!result.price,
          imageCount: result.images?.length || 0
        });
      }

      return result;

    } catch (error) {
      this.metrics.failures++;
      console.error(`❌ Parser error for ${url}:`, error.message);
      return {
        error: error.message,
        confidence: 0,
        url
      };
    }
  }

  async fetchDirect(url) {
    // Get proxy configuration if needed
    const axiosConfig = getAxiosConfig(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    const response = await axios.get(url, axiosConfig);
    return response.data;
  }

  async fetchWithPuppeteer(url) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate with increased timeout
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for common product elements
      try {
        await page.waitForSelector('h1, .product-name, .product-title, [data-testid="product-name"]', {
          timeout: 5000
        });
      } catch (e) {
        // Continue even if selector not found
      }

      // Scroll to load lazy images
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      // Wait for 1 second (compatible with older Puppeteer versions)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const html = await page.content();
      return html;

    } finally {
      await page.close();
    }
  }

  async extractData($, hostname, url) {
    const result = {
      url,
      confidence: 0
    };

    // Try multiple extraction strategies
    const strategies = [
      this.extractJsonLd($),
      this.extractOpenGraph($),
      this.extractSiteSpecific($, hostname),
      this.extractGeneric($)
    ];

    // Merge results from all strategies
    for (const strategy of strategies) {
      if (strategy.name && !result.name) result.name = strategy.name;
      if (strategy.price && !result.price) result.price = strategy.price;
      if (strategy.brand && !result.brand) result.brand = strategy.brand;
      if (strategy.images?.length > 0 && (!result.images || result.images.length === 0)) {
        result.images = strategy.images;
      }
      if (strategy.description && !result.description) result.description = strategy.description;
    }

    // Calculate confidence
    result.confidence = this.calculateConfidence(result);

    // Normalize data
    if (result.price) {
      result.price = this.normalizePrice(result.price);
    }
    if (result.images) {
      result.images = this.normalizeImages(result.images, url);
    }

    return result;
  }

  extractJsonLd($) {
    const result = {};
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
          const product = data.mainEntity || data;
          result.name = product.name;
          result.price = product.offers?.price || product.price;
          result.brand = product.brand?.name || product.brand;
          result.description = product.description;
          result.images = Array.isArray(product.image) ? product.image : [product.image].filter(Boolean);
        }
      } catch (e) {
        // Silent fail
      }
    });
    return result;
  }

  extractOpenGraph($) {
    return {
      name: $('meta[property="og:title"]').attr('content'),
      price: $('meta[property="og:price:amount"]').attr('content') ||
             $('meta[property="product:price:amount"]').attr('content'),
      images: [$('meta[property="og:image"]').attr('content')].filter(Boolean),
      description: $('meta[property="og:description"]').attr('content'),
      brand: $('meta[property="product:brand"]').attr('content')
    };
  }

  extractSiteSpecific($, hostname) {
    const patterns = this.sitePatterns[hostname];
    if (!patterns) return {};

    const result = {};

    for (const [field, selectors] of Object.entries(patterns)) {
      if (typeof selectors === 'function') {
        result[field] = selectors();
        continue;
      }

      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const images = [];
            $(selector).each((i, el) => {
              let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
              if (src) {
                // Handle srcset
                if (src.includes(',')) {
                  src = src.split(',')[0].trim().split(' ')[0];
                }
                images.push(src);
              }
            });
            if (images.length > 0) {
              result[field] = images;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim();
            if (value) {
              result[field] = value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }

    return result;
  }

  extractGeneric($) {
    const result = {};

    for (const [field, selectors] of Object.entries(this.genericPatterns)) {
      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const images = [];
            $(selector).slice(0, 10).each((i, el) => {
              let src = $(el).attr('src') || $(el).attr('data-src');
              if (src && !src.includes('placeholder')) {
                images.push(src);
              }
            });
            if (images.length > 0) {
              result[field] = images;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim();
            if (value) {
              result[field] = value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }

    return result;
  }

  calculateConfidence(result) {
    let score = 0;
    const weights = {
      name: 0.25,
      price: 0.25,
      images: 0.25,
      brand: 0.15,
      description: 0.10
    };

    for (const [field, weight] of Object.entries(weights)) {
      if (result[field]) {
        if (field === 'images' && result[field].length === 0) continue;
        score += weight;
      }
    }

    return Math.min(score, 1);
  }

  normalizePrice(price) {
    if (typeof price === 'number') return price;

    const cleaned = price.toString()
      .replace(/[^0-9.,]/g, '')
      .replace(',', '');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  normalizeImages(images, baseUrl) {
    if (!Array.isArray(images)) return [];

    const normalized = [];
    const baseUrlObj = new URL(baseUrl);

    for (let img of images) {
      if (!img || typeof img !== 'string') continue;

      // Handle protocol-relative URLs
      if (img.startsWith('//')) {
        img = 'https:' + img;
      }
      // Handle relative URLs
      else if (img.startsWith('/')) {
        img = `${baseUrlObj.protocol}//${baseUrlObj.host}${img}`;
      }
      // Handle relative URLs without leading slash
      else if (!img.startsWith('http')) {
        img = `${baseUrlObj.protocol}//${baseUrlObj.host}/${img}`;
      }

      normalized.push(img);
    }

    return normalized.slice(0, 10);
  }

  async cleanup() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.attempts > 0
        ? (this.metrics.successes / this.metrics.attempts * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

module.exports = UniversalParserV2;