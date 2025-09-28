const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Puppeteer imports - only load if needed
let puppeteer = null;
let puppeteerExtra = null;
let StealthPlugin = null;

class UniversalParserEnhanced {
  constructor() {
    this.patterns = {};
    this.cache = new Map();
    this.browserInstance = null;
    this.learningMode = process.env.ENABLE_PATTERN_LEARNING !== 'false';

    // Setup configuration
    this.setupConfiguration();

    // Load patterns asynchronously
    this.loadPatterns();

    // Initialize Puppeteer if needed
    this.initPuppeteer();
  }

  setupConfiguration() {
    // Enhanced fetch configuration
    this.fetchConfig = {
      // Sites that definitely need browser rendering
      requiresBrowser: [
        'farfetch.com',
        'ssense.com',
        'net-a-porter.com',
        'cultgaia.com',
        'matchesfashion.com',
        'mytheresa.com',
        'wconcept.com',
        'miumiu.com',
        'prada.com',
        'gucci.com',
        'louisvuitton.com',
        'balenciaga.com',
        'bottegaveneta.com'
      ],

      // Sites that might need browser (try without first)
      maybeBrowser: [
        'zara.com',
        'hm.com',
        'uniqlo.com',
        'gap.com',
        'oldnavy.com'
      ],

      // Timeout configurations
      timeouts: {
        direct: 5000,
        browser: 15000,
        withProxy: 10000
      },

      // Retry configuration
      retries: {
        maxAttempts: 3,
        delay: 1000
      }
    };

    // Enhanced normalization rules
    this.normalization = {
      price: {
        currencies: ['$', '£', '€', '¥', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'KRW', 'JPY'],
        decimal: '.',
        thousands: ','
      },
      images: {
        transforms: {
          'shopify.com': (url) => url.replace(/_\d+x\d+/, '_2048x2048'),
          'zara.com': (url) => url.replace(/w=\d+/, 'w=1920'),
          'hm.com': (url) => url.replace(/call=url\[file:.+?\]/, 'call=url[file:/product/main]'),
          'uniqlo.com': (url) => url.replace(/\$prod\$/, '$pdp-zoom$')
        },
        maxImages: 10,
        minWidth: 200,
        minHeight: 200
      }
    };

    // Enhanced confidence weights
    this.confidenceWeights = {
      fields: {
        name: 0.25,
        price: 0.25,
        images: 0.20,
        brand: 0.15,
        description: 0.15
      },
      sourceBonus: {
        jsonLd: 0.3,
        openGraph: 0.2,
        microdata: 0.15,
        patterns: 0.1,
        browser: 0.25, // Bonus for browser extraction
        generic: 0
      },
      minimumConfidence: parseFloat(process.env.UNIVERSAL_CONFIDENCE || '0.7')
    };

    // Enhanced cache configuration
    this.cacheConfig = {
      enabled: true,
      ttl: parseInt(process.env.UNIVERSAL_CACHE_TTL || '3600000'),
      maxSize: 200,
      browserCacheTTL: 7200000 // 2 hours for browser results
    };

    this.logLevel = process.env.UNIVERSAL_LOG_LEVEL || 'normal';
    this.mode = process.env.UNIVERSAL_MODE || 'shadow';
  }

  async initPuppeteer() {
    try {
      // Lazy load Puppeteer modules
      if (!puppeteerExtra) {
        puppeteerExtra = require('puppeteer-extra');
        StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteerExtra.use(StealthPlugin());
      }

      if (this.logLevel === 'verbose') {
        console.log('🎭 Puppeteer modules loaded for browser rendering');
      }
    } catch (e) {
      console.log('⚠️ Puppeteer not available - browser rendering disabled');
      this.fetchConfig.requiresBrowser = [];
    }
  }

  async loadPatterns() {
    try {
      const data = await fs.readFile('./pattern-db.json', 'utf8');
      this.patterns = JSON.parse(data);

      if (this.logLevel === 'verbose') {
        console.log('✅ Loaded pattern database with', Object.keys(this.patterns).length, 'sites');
      }
    } catch (e) {
      // Initialize with empty patterns
      this.patterns = {
        _meta: {
          version: '2.0',
          updated: new Date().toISOString(),
          total_sites: 0,
          successful_extractions: 0
        },
        learned_patterns: {},
        global_patterns: {
          price: ['.price', '[data-price]', '.product-price', "[itemprop='price']"],
          name: ['h1', '.product-name', '[data-product-name]', "[itemprop='name']"],
          images: ['.product-image img', '.gallery img', '[data-role="product-image"] img'],
          brand: ['.brand', "[itemprop='brand']", '.product-brand', '[data-brand]']
        }
      };

      await this.savePatterns();
    }
  }

  async parse(url, options = {}) {
    const hostname = new URL(url).hostname.replace('www.', '');

    if (this.logLevel !== 'quiet') {
      console.log(`🧠 Universal Parser Enhanced attempting: ${hostname}`);
    }

    // Check cache first
    const cached = this.getCached(url);
    if (cached) {
      if (this.logLevel === 'verbose') {
        console.log('📦 Returning cached result');
      }
      return cached;
    }

    try {
      let result = null;
      let usedBrowser = false;

      // Determine fetch strategy
      const needsBrowser = this.shouldUseBrowser(hostname, options);

      if (needsBrowser) {
        // Try browser rendering
        result = await this.parseWithBrowser(url);
        usedBrowser = true;
      } else {
        // Try direct fetch first
        result = await this.parseWithAxios(url);

        // If direct fetch failed and site might need browser, retry with browser
        if (result.confidence < 0.5 && this.fetchConfig.maybeBrowser.includes(hostname)) {
          if (this.logLevel === 'verbose') {
            console.log('📉 Low confidence from direct fetch, trying browser...');
          }
          const browserResult = await this.parseWithBrowser(url);
          if (browserResult.confidence > result.confidence) {
            result = browserResult;
            usedBrowser = true;
          }
        }
      }

      // Learn from successful extraction
      if (result.confidence > 0.7 && this.learningMode) {
        await this.learnFromSuccess(hostname, result);
      }

      // Cache successful results
      if (result.confidence > 0.5) {
        const cacheTTL = usedBrowser ? this.cacheConfig.browserCacheTTL : this.cacheConfig.ttl;
        this.setCached(url, result, cacheTTL);
      }

      // Add metadata
      result.extraction_method = usedBrowser ? 'browser' : 'direct';
      result.hostname = hostname;

      return result;

    } catch (error) {
      console.error(`Universal parser error for ${url}:`, error.message);
      return {
        error: error.message,
        confidence: 0,
        url
      };
    }
  }

  shouldUseBrowser(hostname, options) {
    // Force browser if specified
    if (options.forceBrowser) return true;

    // Check if site requires browser
    return this.fetchConfig.requiresBrowser.some(site => hostname.includes(site));
  }

  async parseWithAxios(url) {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    return await this.extractData($, url);
  }

  async parseWithBrowser(url) {
    if (!puppeteerExtra) {
      throw new Error('Browser rendering not available');
    }

    const startTime = Date.now();

    try {
      // Launch or reuse browser
      if (!this.browserInstance) {
        this.browserInstance = await puppeteerExtra.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        });

        if (this.logLevel === 'verbose') {
          console.log('🌐 Browser launched');
        }
      }

      const page = await this.browserInstance.newPage();

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.fetchConfig.timeouts.browser
      });

      // Wait for common product elements
      try {
        await page.waitForSelector('h1, .product-name, [data-testid="product-name"]', {
          timeout: 5000
        });
      } catch (e) {
        // Continue even if selector not found
      }

      // Extract data from rendered page
      const html = await page.content();
      const $ = cheerio.load(html);

      // Also try to extract data directly from page context
      const pageData = await page.evaluate(() => {
        const data = {};

        // Try to find React/Vue/Angular data
        const productData = window.__INITIAL_STATE__ ||
                          window.__PRELOADED_STATE__ ||
                          window.__NUXT__ ||
                          window.productData;

        if (productData) {
          // Extract from JavaScript data
          const findNestedValue = (obj, keys) => {
            for (const key of keys) {
              const parts = key.split('.');
              let value = obj;
              for (const part of parts) {
                value = value?.[part];
                if (!value) break;
              }
              if (value) return value;
            }
            return null;
          };

          data.name = findNestedValue(productData, ['product.name', 'productName', 'title']);
          data.price = findNestedValue(productData, ['product.price', 'price.current', 'pricing.salePrice']);
          data.brand = findNestedValue(productData, ['product.brand', 'brand.name', 'manufacturer']);
          data.images = findNestedValue(productData, ['product.images', 'images', 'gallery']);
        }

        return data;
      });

      await page.close();

      // Combine HTML extraction with JavaScript data
      const result = await this.extractData($, url);

      // Merge JavaScript data if available
      if (pageData.name && !result.name) result.name = pageData.name;
      if (pageData.price && !result.price) result.price = this.parsePrice(pageData.price);
      if (pageData.brand && !result.brand) result.brand = pageData.brand;
      if (pageData.images && (!result.images || result.images.length === 0)) {
        result.images = Array.isArray(pageData.images) ? pageData.images : [pageData.images];
      }

      const endTime = Date.now();
      result.extractionTime = endTime - startTime;

      if (this.logLevel === 'verbose') {
        console.log(`🎭 Browser extraction completed in ${result.extractionTime}ms`);
      }

      return result;

    } catch (error) {
      console.error('Browser extraction error:', error.message);

      // Return partial results
      return {
        error: error.message,
        confidence: 0,
        url
      };
    }
  }

  async extractData($, url) {
    const hostname = new URL(url).hostname.replace('www.', '');

    // Run all extraction strategies in parallel
    const [jsonLd, openGraph, microdata, patterns, generic, learned] = await Promise.all([
      Promise.resolve(this.extractJsonLd($)).catch(() => ({})),
      Promise.resolve(this.extractOpenGraph($)).catch(() => ({})),
      Promise.resolve(this.extractMicrodata($)).catch(() => ({})),
      Promise.resolve(this.extractWithPatterns($, hostname)).catch(() => ({})),
      Promise.resolve(this.extractGeneric($)).catch(() => ({})),
      Promise.resolve(this.extractWithLearnedPatterns($, hostname)).catch(() => ({}))
    ]);

    const strategies = { jsonLd, openGraph, microdata, patterns, generic, learned };

    // Merge and score
    const merged = this.mergeStrategies(strategies);
    merged.confidence = this.calculateConfidence(merged);
    merged.url = url;

    return merged;
  }

  async extractWithLearnedPatterns($, hostname) {
    const learnedPatterns = this.patterns.learned_patterns?.[hostname];
    if (!learnedPatterns) return {};

    const results = {};

    for (const [field, selector] of Object.entries(learnedPatterns)) {
      try {
        if (field === 'images') {
          const images = [];
          $(selector).each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) images.push(src);
          });
          if (images.length > 0) {
            results[field] = images;
          }
        } else {
          const value = $(selector).first().text()?.trim() || $(selector).first().attr('content');
          if (value) {
            results[field] = field === 'price' ? this.parsePrice(value) : value;
          }
        }
      } catch (e) {
        // Silent fail
      }
    }

    return results;
  }

  async learnFromSuccess(hostname, result) {
    if (!this.patterns.learned_patterns) {
      this.patterns.learned_patterns = {};
    }

    // Record successful selectors
    const successfulSelectors = {};

    ['name', 'price', 'brand', 'images'].forEach(field => {
      const source = result[`${field}_source`];
      if (source && result[field]) {
        // Store the selector that worked
        successfulSelectors[field] = source;
      }
    });

    if (Object.keys(successfulSelectors).length > 0) {
      const existingPatterns = this.patterns.learned_patterns[hostname];
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Check if we already have a success today
      if (existingPatterns?.lastSuccess) {
        const lastSuccessDate = existingPatterns.lastSuccess.split('T')[0];
        if (lastSuccessDate === today) {
          // Already logged today, just update patterns but not count
          this.patterns.learned_patterns[hostname] = {
            ...existingPatterns,
            ...successfulSelectors,
            lastSuccess: existingPatterns.lastSuccess, // Keep original timestamp
            successCount: existingPatterns.successCount // Keep same count
          };
          console.log(`📊 Updated patterns for ${hostname} (already logged today)`);
          return; // Don't increment counters
        }
      }

      // New success or different day
      this.patterns.learned_patterns[hostname] = {
        ...existingPatterns,
        ...successfulSelectors,
        lastSuccess: now.toISOString(),
        successCount: 1 // Reset to 1 for new tracking
      };

      // Update metadata
      this.patterns._meta.successful_extractions = (this.patterns._meta.successful_extractions || 0) + 1;
      this.patterns._meta.updated = new Date().toISOString();

      // Save patterns
      await this.savePatterns();

      if (this.logLevel === 'verbose') {
        console.log(`📚 Learned patterns for ${hostname}`);
      }
    }
  }

  async cleanup() {
    // Close browser if open
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
      console.log('🌐 Browser closed');
    }
  }

  // Include all the existing methods from universal-parser.js
  // (fetchPage, extractJsonLd, extractOpenGraph, extractMicrodata, etc.)
  // These remain the same as in the original implementation

  async fetchPage(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const timeout = this.fetchConfig.timeouts.direct;

    const config = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      },
      timeout,
      maxRedirects: 5
    };

    const response = await axios.get(url, config);
    return response.data;
  }

  extractJsonLd($) {
    const results = {};
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
          const product = data.mainEntity || data;
          results.name = product.name;
          results.price = this.parsePrice(product.offers?.price || product.price);
          results.brand = product.brand?.name || product.brand;
          results.description = product.description;
          results.images = this.normalizeImages(product.image);
          results.currency = product.offers?.priceCurrency;
          results.availability = product.offers?.availability;
          results.sku = product.sku;

          if (Array.isArray(product.offers)) {
            results.sizes = product.offers.map(offer => offer.sku || offer.name).filter(Boolean);
            results.price = this.parsePrice(product.offers[0]?.price);
          }
        }
      } catch (e) {
        // Silent fail
      }
    });
    return results;
  }

  extractOpenGraph($) {
    return {
      name: $('meta[property="og:title"]').attr('content'),
      price: this.parsePrice(
        $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content')
      ),
      currency: $('meta[property="product:price:currency"]').attr('content'),
      images: [$('meta[property="og:image"]').attr('content')].filter(Boolean),
      description: $('meta[property="og:description"]').attr('content'),
      brand: $('meta[property="product:brand"]').attr('content'),
      availability: $('meta[property="product:availability"]').attr('content')
    };
  }

  extractMicrodata($) {
    const results = {
      name: $('[itemprop="name"]').first().text()?.trim(),
      price: this.parsePrice(
        $('[itemprop="price"]').attr('content') ||
        $('[itemprop="price"]').text()
      ),
      brand: $('[itemprop="brand"]').text()?.trim(),
      images: [],
      description: $('[itemprop="description"]').text()?.trim(),
      availability: $('[itemprop="availability"]').attr('content')
    };

    $('[itemprop="image"]').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('content') || $(el).attr('href');
      if (src) results.images.push(src);
    });

    return results;
  }

  extractWithPatterns($, hostname) {
    const sitePatterns = this.patterns[hostname];
    const globalPatterns = this.patterns.global_patterns;

    if (!sitePatterns && !globalPatterns) return {};

    const results = {};
    const patternsToUse = { ...globalPatterns, ...sitePatterns };

    for (const [field, selectors] of Object.entries(patternsToUse)) {
      if (!Array.isArray(selectors)) continue;

      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const images = [];
            $(selector).each((i, el) => {
              const src = $(el).attr('src') || $(el).attr('data-src');
              if (src) images.push(src);
            });
            if (images.length > 0) {
              results[field] = images;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim() ||
                         $(selector).first().attr('content');
            if (value) {
              results[field] = field === 'price' ? this.parsePrice(value) : value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }
    return results;
  }

  extractGeneric($) {
    const patterns = {
      name: ['h1', '.product-title', '.product-name', '[data-testid="product-name"]', '.item-name'],
      price: ['.price', '.product-price', '[data-price]', '.current-price', '.now-price', '.sale-price'],
      brand: ['.brand', '.product-brand', '[data-brand]', '.designer', '.vendor'],
      images: ['.product-image img', '.gallery img', '.product-photo img', '.media img'],
      description: ['.product-description', '.description', '[data-description]', '.product-details']
    };

    const results = {};

    for (const [field, selectors] of Object.entries(patterns)) {
      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const imgs = [];
            $(selector).each((i, el) => {
              const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
              if (src && !src.includes('placeholder') && !src.includes('blank')) {
                imgs.push(src);
              }
            });
            if (imgs.length > 0) {
              results[field] = imgs.slice(0, this.normalization.images.maxImages);
              break;
            }
          } else {
            const elem = $(selector).first();
            let value = elem.text()?.trim();

            if (!value && field === 'price') {
              value = elem.attr('data-price') || elem.attr('data-value');
            }

            if (value) {
              results[field] = field === 'price' ? this.parsePrice(value) : value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }
    return results;
  }

  mergeStrategies(strategies) {
    const merged = {};
    const priority = ['jsonLd', 'learned', 'openGraph', 'patterns', 'microdata', 'generic'];
    const fields = ['name', 'price', 'brand', 'images', 'description', 'currency', 'availability', 'sku'];

    for (const field of fields) {
      for (const strategy of priority) {
        const value = strategies[strategy]?.[field];
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          merged[field] = value;
          merged[`${field}_source`] = strategy;
          break;
        }
      }
    }

    if (merged.images) {
      merged.images = this.processImages(merged.images);
    }

    return merged;
  }

  calculateConfidence(data) {
    let score = 0;
    const weights = this.confidenceWeights.fields;

    for (const [field, weight] of Object.entries(weights)) {
      if (data[field]) {
        score += weight;

        const source = data[`${field}_source`];
        if (source && this.confidenceWeights.sourceBonus[source]) {
          score += weight * this.confidenceWeights.sourceBonus[source];
        }
      }
    }

    return Math.min(score, 1);
  }

  parsePrice(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value);
    let cleaned = str;

    for (const currency of this.normalization.price.currencies) {
      cleaned = cleaned.replace(new RegExp(currency, 'g'), '');
    }

    const patterns = [
      /([\d,]+\.?\d*)/,
      /([\d\s]+,\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let number = match[1];
        if (number.includes(',') && !number.includes('.')) {
          const parts = number.split(',');
          if (parts[parts.length - 1].length <= 2) {
            number = number.replace(',', '.');
          }
        }
        number = number.replace(/[,\s]/g, '');
        const parsed = parseFloat(number);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return null;
  }

  normalizeImages(images) {
    if (!images) return [];
    if (typeof images === 'string') return [images];
    if (Array.isArray(images)) return images;
    return [];
  }

  processImages(images) {
    if (!images || !Array.isArray(images)) return [];

    const processed = [...new Set(images)]
      .filter(img => img && (img.startsWith('http') || img.startsWith('//')))
      .map(img => img.startsWith('//') ? 'https:' + img : img)
      .slice(0, this.normalization.images.maxImages);

    return processed.map(img => {
      try {
        const url = new URL(img);
        const domain = url.hostname;

        for (const [pattern, transform] of Object.entries(this.normalization.images.transforms)) {
          if (domain.includes(pattern)) {
            return transform(img);
          }
        }
      } catch (e) {
        // Invalid URL, return as is
      }
      return img;
    });
  }

  getCached(url) {
    if (!this.cacheConfig.enabled) return null;

    const cached = this.cache.get(url);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const ttl = cached.browserResult ? this.cacheConfig.browserCacheTTL : this.cacheConfig.ttl;

    if (age > ttl) {
      this.cache.delete(url);
      return null;
    }

    return cached.data;
  }

  setCached(url, data, ttl) {
    if (!this.cacheConfig.enabled) return;

    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now(),
      browserResult: data.extraction_method === 'browser'
    });
  }

  async savePatterns() {
    try {
      await fs.writeFile('./pattern-db.json', JSON.stringify(this.patterns, null, 2));
    } catch (e) {
      console.error('Failed to save patterns:', e);
    }
  }
}

module.exports = UniversalParserEnhanced;