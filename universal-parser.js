const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs').promises;

class UniversalParser {
  constructor() {
    this.patterns = {};
    this.cache = new Map();

    // Load configuration
    this.setupConfiguration();

    // Load patterns asynchronously
    this.loadPatterns();
  }

  setupConfiguration() {
    // Fetch configuration
    this.fetchConfig = {
      // Sites that need browser rendering
      requiresBrowser: [
        'farfetch.com',
        'ssense.com',
        'net-a-porter.com',
        'cultgaia.com',
        'matchesfashion.com',
        'mytheresa.com',
        'wconcept.com'
      ],

      // Sites that need proxy
      requiresProxy: [
        'cos.com',
        'arket.com',
        'stories.com'
      ],

      // Sites with strict bot protection
      requiresSpecialHeaders: {
        'nike.com': {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      },

      // Timeout per strategy
      timeouts: {
        direct: 5000,      // 5 seconds
        browser: 15000,    // 15 seconds
        withProxy: 10000   // 10 seconds
      }
    };

    // Normalization rules
    this.normalization = {
      price: {
        currencies: ['$', '£', '€', '¥', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        decimal: '.',
        thousands: ','
      },
      images: {
        transforms: {
          'shopify.com': (url) => url.replace(/_\d+x\d+/, '_2048x2048'),
          'zara.com': (url) => url.replace(/w=\d+/, 'w=1920'),
          'hm.com': (url) => url.replace(/call=url\[file:.+?\]/, 'call=url[file:/product/main]')
        },
        maxImages: 10,
        minWidth: 200,
        minHeight: 200
      },
      brand: {
        mappings: {
          'cos': 'COS',
          'hm': 'H&M',
          'zara': 'Zara',
          'stories': '& Other Stories'
        }
      }
    };

    // Confidence scoring weights
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
        generic: 0
      },
      minimumConfidence: parseFloat(process.env.UNIVERSAL_CONFIDENCE || '0.7')
    };

    // Cache configuration
    this.cacheConfig = {
      enabled: true,
      ttl: parseInt(process.env.UNIVERSAL_CACHE_TTL || '3600000'), // 1 hour default
      maxSize: 100
    };

    // Logging configuration
    this.logLevel = process.env.UNIVERSAL_LOG_LEVEL || 'normal';
    this.mode = process.env.UNIVERSAL_MODE || 'shadow';
  }

  async loadPatterns() {
    try {
      const data = await fs.readFile('./pattern-db.json', 'utf8');
      this.patterns = JSON.parse(data);
      if (this.logLevel === 'verbose') {
        console.log('✅ Loaded pattern database with', Object.keys(this.patterns).length, 'sites');
      }
    } catch (e) {
      // Initialize with empty patterns if file doesn't exist
      this.patterns = {
        _meta: {
          version: '1.0',
          updated: new Date().toISOString(),
          total_sites: 0
        },
        global_patterns: {
          price: ['.price', '[data-price]', '.product-price', "[itemprop='price']"],
          name: ['h1', '.product-name', '[data-product-name]', "[itemprop='name']"],
          images: ['.product-image img', '.gallery img', '[data-role="product-image"] img'],
          brand: ['.brand', "[itemprop='brand']", '.product-brand', '[data-brand]']
        }
      };

      // Save initial pattern file
      this.savePatterns().catch(err => {
        console.error('Failed to save initial patterns:', err);
      });
    }
  }

  async parse(url) {
    const hostname = new URL(url).hostname.replace('www.', '');

    if (this.logLevel !== 'quiet') {
      console.log(`🧠 Universal parser attempting: ${hostname}`);
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
      // Step 1: Fetch HTML
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      // Step 2: Run all extraction strategies in parallel
      const [jsonLd, openGraph, microdata, patterns, generic] = await Promise.all([
        Promise.resolve(this.extractJsonLd($)).catch(() => ({})),
        Promise.resolve(this.extractOpenGraph($)).catch(() => ({})),
        Promise.resolve(this.extractMicrodata($)).catch(() => ({})),
        Promise.resolve(this.extractWithPatterns($, hostname)).catch(() => ({})),
        Promise.resolve(this.extractGeneric($)).catch(() => ({}))
      ]);

      const strategies = { jsonLd, openGraph, microdata, patterns, generic };

      // Step 3: Merge and score
      const merged = this.mergeStrategies(strategies);
      merged.confidence = this.calculateConfidence(merged);
      merged.url = url;

      // Step 4: Learn from success
      if (merged.confidence > 0.7 && process.env.ENABLE_PATTERN_LEARNING !== 'false') {
        await this.saveSuccessfulPatterns(hostname, strategies);
      }

      // Cache successful results
      if (merged.confidence > 0.5) {
        this.setCached(url, merged);
      }

      if (this.logLevel === 'verbose') {
        console.log('📊 Extraction result:', {
          confidence: merged.confidence,
          hasName: !!merged.name,
          hasPrice: !!merged.price,
          imageCount: merged.images?.length || 0
        });
      }

      return merged;
    } catch (error) {
      console.error(`Universal parser error for ${url}:`, error.message);
      return {
        error: error.message,
        confidence: 0,
        url
      };
    }
  }

  async fetchPage(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const timeout = this.fetchConfig.timeouts.direct;

    const config = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout
    };

    // Add special headers if needed
    if (this.fetchConfig.requiresSpecialHeaders[hostname]) {
      Object.assign(config.headers, this.fetchConfig.requiresSpecialHeaders[hostname]);
    }

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

          // Handle multiple offers (sizes)
          if (Array.isArray(product.offers)) {
            results.sizes = product.offers.map(offer => offer.sku || offer.name).filter(Boolean);
            results.price = this.parsePrice(product.offers[0]?.price);
          }
        }
      } catch (e) {
        // Silent fail for each script tag
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

    // Collect images
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
          // Silent fail for each selector
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
      images: [
        '.product__media img',
        '.product-image img',
        '.swiper-slide img',
        '.gallery img',
        '.product-photo img',
        '.media img',
        '.product-images img',
        '.product-gallery img',
        'img[src*="product"]',
        'img[srcset]'
      ],
      description: ['.product-description', '.description', '[data-description]', '.product-details']
    };

    const results = {};

    for (const [field, selectors] of Object.entries(patterns)) {
      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const imgs = [];
            $(selector).each((i, el) => {
              // Try multiple attributes
              let src = $(el).attr('src') ||
                       $(el).attr('data-src') ||
                       $(el).attr('data-original');

              // Handle srcset
              if (!src && $(el).attr('srcset')) {
                const srcset = $(el).attr('srcset');
                // Get the first URL from srcset
                src = srcset.split(',')[0].trim().split(' ')[0];
              }

              // Handle data-srcset
              if (!src && $(el).attr('data-srcset')) {
                const srcset = $(el).attr('data-srcset');
                src = srcset.split(',')[0].trim().split(' ')[0];
              }

              // Filter out placeholders and ensure it's a real image
              if (src &&
                  !src.includes('placeholder') &&
                  !src.includes('blank.gif') &&
                  !src.includes('data:image') &&
                  !src.includes('transparent.png')) {

                // Ensure full URL
                if (src.startsWith('//')) {
                  src = 'https:' + src;
                }

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
              // Try to get price from data attributes
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
    const priority = ['jsonLd', 'openGraph', 'patterns', 'microdata', 'generic'];
    const fields = ['name', 'price', 'brand', 'description', 'currency', 'availability', 'sku'];

    // Handle most fields normally
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

    // Special handling for images - combine from multiple sources
    const allImages = [];
    const imageSources = [];

    for (const strategy of priority) {
      const images = strategies[strategy]?.images;
      if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(img => {
          if (img && !allImages.includes(img)) {
            allImages.push(img);
          }
        });
        if (!imageSources.includes(strategy)) {
          imageSources.push(strategy);
        }
      }
    }

    if (allImages.length > 0) {
      merged.images = allImages;
      merged.images_source = imageSources.join('+');
    }

    // Post-process images
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

        // Add source bonus
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

    // Remove currency symbols
    let cleaned = str;
    for (const currency of this.normalization.price.currencies) {
      cleaned = cleaned.replace(new RegExp(currency, 'g'), '');
    }

    // Extract number patterns
    const patterns = [
      /([\d,]+\.?\d*)/,  // Standard format
      /([\d\s]+,\d{2})/,  // European format
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        // Handle European format (comma as decimal)
        let number = match[1];
        if (number.includes(',') && !number.includes('.')) {
          // Check if comma is decimal separator
          const parts = number.split(',');
          if (parts[parts.length - 1].length <= 2) {
            number = number.replace(',', '.');
          }
        }
        // Remove thousands separators
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

    // First, normalize protocol-relative URLs and ensure full URLs
    const normalized = images.map(img => {
      if (!img) return null;

      // Handle protocol-relative URLs
      if (img.startsWith('//')) {
        return 'https:' + img;
      }

      // Already has protocol
      if (img.startsWith('http://') || img.startsWith('https://')) {
        return img;
      }

      // Relative URL - we can't process without base URL
      return null;
    }).filter(img => img !== null);

    // Remove duplicates and limit to max
    const processed = [...new Set(normalized)]
      .slice(0, this.normalization.images.maxImages);

    // Apply transformations based on domain
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
        // If URL parsing fails, return as is
      }
      return img;
    });
  }

  async saveSuccessfulPatterns(hostname, strategies) {
    // Don't save in shadow mode unless explicitly testing
    if (this.mode === 'shadow' && process.env.FORCE_PATTERN_SAVE !== 'true') {
      return;
    }

    if (!this.patterns[hostname]) {
      this.patterns[hostname] = {};
    }

    // Update metadata
    this.patterns[hostname].lastSuccess = new Date().toISOString();
    this.patterns[hostname].successCount = (this.patterns[hostname].successCount || 0) + 1;

    // Save patterns file
    await this.savePatterns();
  }

  async savePatterns() {
    try {
      await fs.writeFile('./pattern-db.json', JSON.stringify(this.patterns, null, 2));
    } catch (e) {
      console.error('Failed to save patterns:', e);
    }
  }

  getCached(url) {
    if (!this.cacheConfig.enabled) return null;

    const cached = this.cache.get(url);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheConfig.ttl) {
      this.cache.delete(url);
      return null;
    }

    return cached.data;
  }

  setCached(url, data) {
    if (!this.cacheConfig.enabled) return;

    // Enforce max cache size
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now()
    });
  }
}

module.exports = UniversalParser;