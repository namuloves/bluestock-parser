/**
 * Smart Image Extractor - Sophisticated image discovery system
 * Uses adaptive learning, pattern recognition, and self-healing architecture
 */

const axios = require('axios');

class SmartImageExtractor {
  constructor() {
    this.patterns = new Map();
    this.successfulPatterns = new Map();
    this.failurePatterns = new Map();
    this.loadPatterns();
  }

  async loadPatterns() {
    // Load learned patterns from storage
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const patternsFile = path.join(__dirname, '../data/image-patterns.json');
      const data = await fs.readFile(patternsFile, 'utf8');
      const patterns = JSON.parse(data);

      for (const [domain, domainPatterns] of Object.entries(patterns)) {
        this.patterns.set(domain, domainPatterns);
      }
    } catch (error) {
      // Initialize with seed patterns
      this.initializeSeedPatterns();
    }
  }

  initializeSeedPatterns() {
    const seedPatterns = {
      'wconcept.com': {
        variants: [
          { pattern: /\/(\d+)_1\.jpg/, replace: (match, productId) =>
            Array.from({length: 8}, (_, i) => match.replace('_1.jpg', `_${i+1}.jpg`)) },
        ],
        selectors: [
          '.product-gallery img',
          '.image-slider img',
          '[data-image-role="product-image"]'
        ],
        jsPatterns: [
          /"images?"\s*:\s*\[(.*?)\]/g,
          /productImages\s*=\s*\[(.*?)\]/g
        ]
      },

      'zara.com': {
        variants: [
          { pattern: /\/p\/(\d+)\/(\d+)\/(\d+)\/.*?\.jpg/, replace: (match, p1, p2, p3) =>
            Array.from({length: 6}, (_, i) => match.replace(/\/\d+\.jpg/, `/${i+1}.jpg`)) }
        ],
        selectors: [
          '.media-image img',
          '.product-detail-images img'
        ]
      },

      'ssense.com': {
        variants: [
          { pattern: /(.+)_1_(\d+x\d+)\.jpg/, replace: (match, base, size) =>
            Array.from({length: 10}, (_, i) => `${base}_${i+1}_${size}.jpg`) }
        ],
        selectors: [
          '.product-gallery img',
          '.carousel-item img'
        ]
      },

      'net-a-porter.com': {
        selectors: [
          '.product-image img',
          '.image-carousel img'
        ],
        jsPatterns: [
          /imageUrls\s*:\s*\[(.*?)\]/g
        ]
      },

      'farfetch.com': {
        selectors: [
          '[data-testid="product-image"] img',
          '.product-images img'
        ],
        jsPatterns: [
          /images\s*:\s*\[(.*?)\]/g
        ]
      },

      // Shopify pattern (many sites use this)
      'shopify': {
        variants: [
          { pattern: /(.+)\.jpg/, replace: (match, base) =>
            Array.from({length: 8}, (_, i) => `${base}_${i > 0 ? i+1 : ''}.jpg`) }
        ],
        transforms: [
          (url) => url.replace(/_\d+x\d+/, '_2048x2048'),
          (url) => url.replace(/\?.*$/, ''),
          (url) => url + '?width=1920'
        ]
      }
    };

    for (const [domain, patterns] of Object.entries(seedPatterns)) {
      this.patterns.set(domain, patterns);
    }
  }

  /**
   * Main extraction method - tries multiple strategies
   */
  async extractImages($, url, options = {}) {
    const domain = new URL(url).hostname.replace('www.', '');
    const images = new Set();
    const strategies = [];

    // Strategy 1: JavaScript extraction
    const jsImages = await this.extractFromJavaScript($, domain);
    if (jsImages.length > 0) {
      jsImages.forEach(img => images.add(img));
      strategies.push({ method: 'javascript', count: jsImages.length });
    }

    // Strategy 2: HTML selectors (domain-specific + global)
    const htmlImages = await this.extractFromHTML($, domain);
    if (htmlImages.length > 0) {
      htmlImages.forEach(img => images.add(img));
      strategies.push({ method: 'html', count: htmlImages.length });
    }

    // Strategy 3: Pattern-based generation
    const patternImages = await this.generateFromPatterns(url, domain);
    if (patternImages.length > 0) {
      patternImages.forEach(img => images.add(img));
      strategies.push({ method: 'patterns', count: patternImages.length });
    }

    // Strategy 4: Meta image + intelligent variants
    const metaImages = await this.extractMetaAndVariants($, url);
    if (metaImages.length > 0) {
      metaImages.forEach(img => images.add(img));
      strategies.push({ method: 'meta', count: metaImages.length });
    }

    let imageArray = Array.from(images);

    // Validate images if not too many
    if (imageArray.length <= 15 && options.validate !== false) {
      imageArray = await this.validateImages(imageArray, domain);
      strategies.push({ method: 'validation', count: imageArray.length });
    }

    // Apply domain-specific transforms
    imageArray = this.applyTransforms(imageArray, domain);

    // Learn from successful extraction
    if (imageArray.length > 1) {
      await this.learnSuccessfulPattern(domain, strategies, imageArray);
    }

    return {
      images: imageArray,
      strategies: strategies,
      confidence: this.calculateConfidence(strategies, imageArray.length)
    };
  }

  /**
   * Extract images from JavaScript/JSON data
   */
  extractFromJavaScript($, domain) {
    const images = new Set();
    const domainPatterns = this.patterns.get(domain);

    // Use domain-specific patterns if available
    let jsPatterns = domainPatterns?.jsPatterns || [];

    // Add universal patterns
    jsPatterns = jsPatterns.concat([
      /"images?"\s*:\s*\[(.*?)\]/g,
      /images?\s*=\s*\[(.*?)\]/g,
      /"gallery"\s*:\s*\[(.*?)\]/g,
      /productImages\s*:\s*\[(.*?)\]/g,
      /"image"\s*:\s*"([^"]+)"/g,
      /imageUrl\s*:\s*"([^"]+)"/g,
      // Direct URL patterns
      /https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi
    ]);

    $('script').each((i, elem) => {
      const content = $(elem).html();
      if (!content) return;

      jsPatterns.forEach(pattern => {
        try {
          const matches = [...content.matchAll(pattern)];
          matches.forEach(match => {
            if (match[1]) {
              // Extract URLs from array content
              const urls = match[1].match(/https?:\/\/[^"'\s,\]]+\.(jpg|jpeg|png|webp)/gi);
              if (urls) {
                urls.forEach(url => {
                  const cleanUrl = url.replace(/[",\]]+$/, '');
                  if (this.isValidImageUrl(cleanUrl)) {
                    images.add(cleanUrl);
                  }
                });
              }
            } else if (match[0] && this.isValidImageUrl(match[0])) {
              // Direct URL match
              images.add(match[0]);
            }
          });
        } catch (e) {
          // Skip malformed regex
        }
      });
    });

    return Array.from(images);
  }

  /**
   * Extract images from HTML using selectors
   */
  extractFromHTML($, domain) {
    const images = new Set();
    const domainPatterns = this.patterns.get(domain);

    // Domain-specific selectors
    let selectors = domainPatterns?.selectors || [];

    // Add universal selectors
    selectors = selectors.concat([
      '.product-image img',
      '.product-gallery img',
      '.gallery img',
      '.image-gallery img',
      '.product-slider img',
      '.carousel img',
      '[data-role="product-image"] img',
      '[data-testid*="image"] img',
      '.media img',
      '.product-media img'
    ]);

    selectors.forEach(selector => {
      try {
        $(selector).each((i, elem) => {
          const src = $(elem).attr('src') ||
                      $(elem).attr('data-src') ||
                      $(elem).attr('data-original') ||
                      $(elem).attr('data-lazy');

          if (src && this.isValidImageUrl(src)) {
            images.add(this.normalizeUrl(src));
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });

    return Array.from(images);
  }

  /**
   * Generate image variants using learned patterns
   */
  async generateFromPatterns(url, domain) {
    const images = new Set();
    const domainPatterns = this.patterns.get(domain);

    if (!domainPatterns?.variants) return [];

    // Get primary image from meta tag
    const metaImage = await this.getMetaImage(url);
    if (!metaImage) return [];

    domainPatterns.variants.forEach(variant => {
      try {
        const match = metaImage.match(variant.pattern);
        if (match) {
          const variants = variant.replace(match[0], ...match.slice(1));
          if (Array.isArray(variants)) {
            variants.forEach(v => {
              if (this.isValidImageUrl(v)) {
                images.add(v);
              }
            });
          }
        }
      } catch (e) {
        // Skip invalid patterns
      }
    });

    return Array.from(images);
  }

  /**
   * Extract meta image and generate intelligent variants
   */
  async extractMetaAndVariants($, url) {
    const images = new Set();

    // Get meta image
    const metaImage = $('meta[property="og:image"]').attr('content');
    if (!metaImage) return [];

    images.add(metaImage);

    // Generate intelligent variants based on URL structure
    const variants = this.generateIntelligentVariants(metaImage);
    variants.forEach(v => images.add(v));

    return Array.from(images);
  }

  /**
   * Generate variants based on common e-commerce patterns
   */
  generateIntelligentVariants(imageUrl) {
    const variants = [];

    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname;

      // Pattern 1: _1, _2, _3 suffix
      if (/_1\.jpg$/.test(pathname)) {
        for (let i = 2; i <= 6; i++) {
          variants.push(imageUrl.replace('_1.jpg', `_${i}.jpg`));
        }
      }

      // Pattern 2: numbered files
      if (/\/1\.jpg$/.test(pathname)) {
        for (let i = 2; i <= 6; i++) {
          variants.push(imageUrl.replace('/1.jpg', `/${i}.jpg`));
        }
      }

      // Pattern 3: size parameters
      if (url.search.includes('width=') || url.search.includes('w=')) {
        const highRes = imageUrl.replace(/[w|width]=\d+/g, 'width=1920');
        if (highRes !== imageUrl) variants.push(highRes);
      }

      // Pattern 4: quality parameters
      if (!url.search.includes('quality=')) {
        const separator = url.search ? '&' : '?';
        variants.push(`${imageUrl}${separator}quality=90`);
      }

    } catch (e) {
      // Invalid URL
    }

    return variants;
  }

  /**
   * Validate images exist and are accessible
   */
  async validateImages(imageUrls, domain) {
    if (imageUrls.length === 0) return [];

    const batchSize = 8;
    const timeout = 2000;
    const validImages = [];

    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);

      const promises = batch.map(async (url) => {
        try {
          const response = await axios.head(url, {
            timeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          return {
            url,
            valid: response.status === 200,
            contentType: response.headers['content-type'],
            size: response.headers['content-length']
          };
        } catch (error) {
          return { url, valid: false, error: error.code };
        }
      });

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.valid) {
          validImages.push(result.value.url);
        }
      });
    }

    // Learn from validation results
    this.learnFromValidation(domain, imageUrls, validImages);

    return validImages;
  }

  /**
   * Apply domain-specific transforms
   */
  applyTransforms(imageUrls, domain) {
    const domainPatterns = this.patterns.get(domain);
    if (!domainPatterns?.transforms) return imageUrls;

    return imageUrls.map(url => {
      let transformed = url;
      domainPatterns.transforms.forEach(transform => {
        try {
          transformed = transform(transformed);
        } catch (e) {
          // Skip failed transforms
        }
      });
      return transformed;
    });
  }

  /**
   * Learn from successful extractions
   */
  async learnSuccessfulPattern(domain, strategies, images) {
    const pattern = {
      timestamp: Date.now(),
      strategies: strategies,
      imageCount: images.length,
      sampleUrls: images.slice(0, 3) // Store sample URLs for pattern analysis
    };

    if (!this.successfulPatterns.has(domain)) {
      this.successfulPatterns.set(domain, []);
    }

    this.successfulPatterns.get(domain).push(pattern);

    // Keep only recent patterns (last 100)
    const patterns = this.successfulPatterns.get(domain);
    if (patterns.length > 100) {
      patterns.splice(0, patterns.length - 100);
    }

    // Save patterns periodically
    if (Math.random() < 0.1) { // 10% chance
      await this.savePatterns();
    }
  }

  /**
   * Learn from validation results
   */
  learnFromValidation(domain, attempted, successful) {
    const failureRate = 1 - (successful.length / attempted.length);

    if (!this.failurePatterns.has(domain)) {
      this.failurePatterns.set(domain, { totalAttempts: 0, totalFailures: 0 });
    }

    const stats = this.failurePatterns.get(domain);
    stats.totalAttempts += attempted.length;
    stats.totalFailures += (attempted.length - successful.length);

    // If failure rate is high, mark for pattern review
    if (stats.totalAttempts > 20 && (stats.totalFailures / stats.totalAttempts) > 0.7) {
      console.log(`⚠️ High failure rate for ${domain}: ${Math.round(stats.totalFailures / stats.totalAttempts * 100)}%`);
    }
  }

  /**
   * Save learned patterns to storage
   */
  async savePatterns() {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Ensure data directory exists
      const dataDir = path.join(__dirname, '../data');
      await fs.mkdir(dataDir, { recursive: true });

      const patternsFile = path.join(dataDir, 'image-patterns.json');
      const patternsObj = Object.fromEntries(this.patterns);

      await fs.writeFile(patternsFile, JSON.stringify(patternsObj, null, 2));
    } catch (error) {
      console.log('⚠️ Could not save image patterns:', error.message);
    }
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(strategies, imageCount) {
    let confidence = 0;

    strategies.forEach(strategy => {
      switch (strategy.method) {
        case 'javascript': confidence += 0.4; break;
        case 'html': confidence += 0.3; break;
        case 'patterns': confidence += 0.5; break;
        case 'meta': confidence += 0.2; break;
        case 'validation': confidence += 0.3; break;
      }
    });

    // Boost confidence based on image count
    if (imageCount > 3) confidence += 0.2;
    if (imageCount > 6) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  /**
   * Utility methods
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.length > 2000) return false; // Reasonable URL length limit

    try {
      const parsed = new URL(url, 'https://example.com');
      return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(parsed.pathname);
    } catch (e) {
      return false;
    }
  }

  normalizeUrl(url) {
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return url; // Relative URLs need base
    return url;
  }

  async getMetaImage(url) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      const $ = require('cheerio').load(response.data);
      return $('meta[property="og:image"]').attr('content');
    } catch (e) {
      return null;
    }
  }
}

module.exports = { SmartImageExtractor };