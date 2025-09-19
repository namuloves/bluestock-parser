# Universal Parser Implementation Plan

## CRITICAL: READ THIS FIRST
This plan enhances the existing parser WITHOUT breaking it. All 50+ existing scrapers must remain functional throughout the implementation. This is an ADDITION, not a REPLACEMENT.

## Project Overview

### Current State
- 50+ individual site-specific scrapers in `/scrapers/` directory
- Each scraper is fragile and breaks when sites update
- No learning from successes or failures
- Inconsistent response formats

### Goal
Add a universal parser layer that:
1. Tries intelligent extraction first
2. Falls back to existing scrapers when needed
3. Learns from successful patterns
4. Self-heals when sites change

## Architecture Diagram

```
Request Flow:
URL → Universal Parser → Success (>70% confidence) → Return
         ↓ Fail
    Site-Specific Scraper → Success → Return
         ↓ Fail
    Emergency Fallback → Return partial data
```

## Implementation Phases

### Phase 1: Core Universal Parser (Day 1-2)

#### File: `/universal-parser.js`

```javascript
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs').promises;

class UniversalParser {
  constructor() {
    this.loadPatterns();
  }

  async loadPatterns() {
    try {
      const data = await fs.readFile('./pattern-db.json', 'utf8');
      this.patterns = JSON.parse(data);
    } catch (e) {
      this.patterns = {};
    }
  }

  async parse(url) {
    const hostname = new URL(url).hostname;
    console.log(`🧠 Universal parser attempting: ${hostname}`);

    // Step 1: Fetch HTML
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    // Step 2: Try multiple extraction strategies
    const strategies = {
      jsonLd: await this.extractJsonLd($),
      openGraph: await this.extractOpenGraph($),
      microdata: await this.extractMicrodata($),
      patterns: await this.extractWithPatterns($, hostname),
      generic: await this.extractGeneric($)
    };

    // Step 3: Merge and score
    const merged = this.mergeStrategies(strategies);
    merged.confidence = this.calculateConfidence(merged);

    // Step 4: Learn from success
    if (merged.confidence > 0.7) {
      await this.saveSuccessfulPatterns(hostname, strategies);
    }

    return merged;
  }

  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
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
        }
      } catch (e) {}
    });
    return results;
  }

  extractOpenGraph($) {
    return {
      name: $('meta[property="og:title"]').attr('content'),
      price: this.parsePrice($('meta[property="product:price:amount"]').attr('content')),
      images: [$('meta[property="og:image"]').attr('content')].filter(Boolean),
      description: $('meta[property="og:description"]').attr('content'),
      brand: $('meta[property="product:brand"]').attr('content')
    };
  }

  extractMicrodata($) {
    return {
      name: $('[itemprop="name"]').first().text()?.trim(),
      price: this.parsePrice($('[itemprop="price"]').attr('content') || $('[itemprop="price"]').text()),
      brand: $('[itemprop="brand"]').text()?.trim(),
      images: $('[itemprop="image"]').map((i, el) => $(el).attr('src') || $(el).attr('content')).get()
    };
  }

  extractWithPatterns($, hostname) {
    const sitePatterns = this.patterns[hostname];
    if (!sitePatterns) return {};

    const results = {};
    for (const [field, selectors] of Object.entries(sitePatterns)) {
      for (const selector of selectors) {
        try {
          const value = $(selector).first().text()?.trim() || $(selector).first().attr('src');
          if (value) {
            results[field] = field === 'price' ? this.parsePrice(value) : value;
            break;
          }
        } catch (e) {}
      }
    }
    return results;
  }

  extractGeneric($) {
    // Common patterns across e-commerce sites
    const patterns = {
      name: ['h1', '.product-title', '.product-name', '[data-testid="product-name"]'],
      price: ['.price', '.product-price', '[data-price]', '.current-price'],
      brand: ['.brand', '.product-brand', '[data-brand]'],
      images: ['.product-image img', '.gallery img', '.product-photo img']
    };

    const results = {};
    for (const [field, selectors] of Object.entries(patterns)) {
      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const imgs = $(selector).map((i, el) => $(el).attr('src') || $(el).attr('data-src')).get();
            if (imgs.length > 0) {
              results[field] = imgs;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim();
            if (value) {
              results[field] = field === 'price' ? this.parsePrice(value) : value;
              break;
            }
          }
        } catch (e) {}
      }
    }
    return results;
  }

  mergeStrategies(strategies) {
    const merged = {};
    const priority = ['jsonLd', 'openGraph', 'patterns', 'microdata', 'generic'];
    const fields = ['name', 'price', 'brand', 'images', 'description', 'currency'];

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

    return merged;
  }

  calculateConfidence(data) {
    let score = 0;
    const weights = {
      name: 0.3,
      price: 0.3,
      images: 0.2,
      brand: 0.1,
      description: 0.1
    };

    for (const [field, weight] of Object.entries(weights)) {
      if (data[field]) {
        score += weight;
        if (data[`${field}_source`] === 'jsonLd') {
          score += weight * 0.2; // Bonus for reliable source
        }
      }
    }

    return Math.min(score, 1);
  }

  parsePrice(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value);
    const patterns = [
      /[\$£€¥]\s*([\d,]+\.?\d*)/,
      /([\d,]+\.?\d*)\s*(?:USD|EUR|GBP|CAD)/,
      /([\d,]+\.?\d*)/
    ];

    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
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

  async saveSuccessfulPatterns(hostname, strategies) {
    // Save working selectors for future use
    if (!this.patterns[hostname]) {
      this.patterns[hostname] = {};
    }

    // Record what worked
    const timestamp = new Date().toISOString();
    this.patterns[hostname].lastSuccess = timestamp;
    this.patterns[hostname].confidence = 0.8;

    // Don't await this - fire and forget
    fs.writeFile('./pattern-db.json', JSON.stringify(this.patterns, null, 2)).catch(e => {
      console.error('Failed to save patterns:', e);
    });
  }
}

module.exports = UniversalParser;
```

### Phase 2: Integration Layer (Day 2-3)

#### Modify: `/scrapers/index.js`

Add this at the TOP of the file, BEFORE the existing code:

```javascript
// ADD THIS SECTION - DO NOT DELETE EXISTING CODE
const UniversalParser = require('../universal-parser');
let universalParser;

try {
  universalParser = new UniversalParser();
  console.log('✅ Universal parser initialized');
} catch (e) {
  console.error('❌ Universal parser failed to initialize:', e);
  universalParser = null;
}

// Universal parser wrapper with fallback
async function tryUniversalParser(url) {
  if (!universalParser) return null;

  try {
    const result = await universalParser.parse(url);
    console.log(`📊 Universal parser confidence: ${result.confidence}`);

    if (result.confidence > 0.7 && result.name && result.price) {
      return {
        success: true,
        product: normalizeToExistingFormat(result),
        extraction_method: 'universal',
        confidence: result.confidence
      };
    }

    return null;
  } catch (error) {
    console.log('Universal parser error:', error.message);
    return null;
  }
}

// Convert universal parser output to match existing format
function normalizeToExistingFormat(data) {
  return {
    product_name: data.name,
    brand: data.brand || 'Unknown',
    original_price: data.price || 0,
    sale_price: data.sale_price || null,
    is_on_sale: false,
    discount_percentage: null,
    image_urls: data.images || [],
    description: data.description || '',
    currency: data.currency || 'USD',
    availability: data.availability || 'in_stock',

    // Legacy fields for compatibility
    name: data.name,
    price: data.price || 0,
    images: data.images || [],
    url: data.url
  };
}
```

Then MODIFY the existing `scrapeProduct` function (DO NOT DELETE IT):

```javascript
async function scrapeProduct(url, options = {}) {
  const hostname = new URL(url).hostname.replace('www.', '');
  console.log('🔍 Detecting site for:', url);

  // TRY UNIVERSAL PARSER FIRST (NEW)
  if (!options.skipUniversal) {
    const universalResult = await tryUniversalParser(url);
    if (universalResult) {
      console.log('✅ Universal parser succeeded');
      return universalResult;
    }
    console.log('📌 Falling back to site-specific scraper');
  }

  // EXISTING CODE CONTINUES HERE - DO NOT MODIFY
  // All your existing if statements for site detection remain unchanged
  if (hostname.includes('zara')) {
    return scrapeZara(url);
  }
  // ... rest of existing code
}
```

### Phase 3: Testing Framework (Day 3)

#### File: `/test-universal-parser.js`

```javascript
const UniversalParser = require('./universal-parser');

const testUrls = [
  // Sites with good structured data
  { url: 'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html', expected: ['name', 'price', 'images'] },
  { url: 'https://www2.hm.com/en_us/productpage.1234567.html', expected: ['name', 'price'] },

  // Sites that might need fallback
  { url: 'https://www.cos.com/en-us/women/product.html', expected: ['name'] },

  // Unknown site to test generic extraction
  { url: 'https://somerandomshop.com/product', expected: [] }
];

async function runTests() {
  const parser = new UniversalParser();
  const results = [];

  for (const test of testUrls) {
    try {
      console.log(`\nTesting: ${test.url}`);
      const result = await parser.parse(test.url);

      const summary = {
        url: test.url,
        success: result.confidence > 0.5,
        confidence: result.confidence,
        hasName: !!result.name,
        hasPrice: !!result.price,
        imageCount: result.images?.length || 0,
        sources: {
          name: result.name_source,
          price: result.price_source
        }
      };

      console.log('Result:', summary);
      results.push(summary);

    } catch (error) {
      console.error(`Failed: ${error.message}`);
      results.push({ url: test.url, error: error.message });
    }
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => r.error).length}`);
  console.log(`Average confidence: ${
    results.filter(r => r.confidence).reduce((a, b) => a + b.confidence, 0) / results.length
  }`);
}

runTests();
```

### Phase 4: Monitoring (Day 4)

#### File: `/pattern-db.json` (Initial seed file)

```json
{
  "zara.com": {
    "price": [".product-price", "[data-qa='product-price']", ".money-amount__main"],
    "name": ["h1.product-detail-info__header-name", ".product-name"],
    "images": [".media-image__image", ".product-detail-images__image"],
    "lastSuccess": null,
    "confidence": 0.5
  },
  "hm.com": {
    "price": [".price-value", "[data-test='product-price']"],
    "name": ["h1.primary", ".product-item-headline"],
    "lastSuccess": null,
    "confidence": 0.5
  },
  "cos.com": {
    "price": [".price", ".product-price"],
    "name": [".product-name", "h1"],
    "lastSuccess": null,
    "confidence": 0.5
  }
}
```

## Implementation Rules

### DO NOT:
1. Delete ANY existing scraper files
2. Remove ANY existing code from scrapers/index.js
3. Change the response format of existing scrapers
4. Break existing functionality
5. Make the system dependent on universal parser

### ALWAYS:
1. Test universal parser in shadow mode first
2. Keep existing scrapers as fallback
3. Log all decisions for debugging
4. Maintain backwards compatibility
5. Allow disabling universal parser with one flag

## Rollout Strategy

### Week 1: Shadow Mode
```javascript
// In server.js
const UNIVERSAL_MODE = process.env.UNIVERSAL_MODE || 'shadow';

if (UNIVERSAL_MODE === 'shadow') {
  // Run universal parser but don't use results
  const universal = await tryUniversalParser(url);
  logPerformance(universal, specific);
  return specific;  // Always return existing scraper
}
```

### Week 2: Gradual Enable
```javascript
const UNIVERSAL_SITES = process.env.UNIVERSAL_SITES?.split(',') || ['zara.com', 'hm.com'];

if (UNIVERSAL_SITES.includes(hostname)) {
  const universal = await tryUniversalParser(url);
  if (universal?.confidence > 0.8) return universal;
}
return specificScraper(url);
```

### Week 3: Full Enable with Fallback
```javascript
if (UNIVERSAL_MODE === 'full') {
  const universal = await tryUniversalParser(url);
  if (universal?.confidence > 0.6) return universal;
  return specificScraper(url);  // Always have fallback
}
```

## Success Metrics

Track these daily:
```javascript
{
  "date": "2024-01-18",
  "total_requests": 1000,
  "universal_success": 750,    // 75% success rate
  "universal_partial": 150,     // Has some data
  "fallback_used": 100,         // Used specific scraper
  "complete_failure": 0,        // Should stay 0
  "avg_confidence": 0.72,
  "avg_response_time": 1.2      // seconds
}
```

## Emergency Rollback

If something goes wrong:

1. Set environment variable: `UNIVERSAL_MODE=off`
2. Or rename file: `mv universal-parser.js universal-parser.js.disabled`
3. System automatically falls back to existing scrapers

## Testing Checklist

Before considering complete:

- [ ] Universal parser works on 10+ test URLs
- [ ] All existing scrapers still work
- [ ] Response format unchanged
- [ ] Can disable with one config change
- [ ] Performance < 2 seconds per parse
- [ ] Confidence scoring works
- [ ] Pattern learning saves to file
- [ ] Fallback happens smoothly
- [ ] No breaking changes
- [ ] Shadow mode logs show improvement

## Final Notes

This is an ENHANCEMENT, not a replacement. The goal is to make the existing system more robust, not to rewrite it. If at any point the universal parser seems to make things worse, stop and reassess. The existing 50+ scrapers are battle-tested and must remain functional.

Remember: It's better to have a working system with gradual improvements than a broken system with ambitious changes.