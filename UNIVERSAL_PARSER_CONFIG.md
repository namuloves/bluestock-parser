# Universal Parser Configuration Guide

## Prerequisites & Dependencies

### Required npm packages
```bash
# These should already be installed, but verify:
npm list cheerio axios puppeteer-extra

# If any are missing:
npm install cheerio axios
```

### Environment Variables

Add to `.env` file:
```bash
# Universal Parser Configuration
UNIVERSAL_MODE=shadow          # shadow | partial | full | off
UNIVERSAL_CONFIDENCE=0.7       # Minimum confidence to use result (0.0-1.0)
UNIVERSAL_SITES=zara.com,hm.com  # Comma-separated list for partial mode
UNIVERSAL_LOG_LEVEL=verbose     # verbose | normal | quiet
UNIVERSAL_CACHE_TTL=3600       # Cache successful parses for 1 hour
ENABLE_PATTERN_LEARNING=true   # Save successful patterns
```

## Configuration Files

### 1. Pattern Database (`pattern-db.json`)
This file stores learned patterns for each domain. It will be auto-created but you can pre-seed it:

```json
{
  "_meta": {
    "version": "1.0",
    "updated": "2024-01-18",
    "total_sites": 0
  },
  "global_patterns": {
    "price": [
      ".price",
      "[data-price]",
      ".product-price",
      "[itemprop='price']",
      ".current-price",
      ".sale-price"
    ],
    "name": [
      "h1",
      ".product-name",
      "[data-product-name]",
      "[itemprop='name']",
      ".product-title"
    ],
    "images": [
      ".product-image img",
      ".gallery img",
      "[data-role='product-image'] img",
      ".product-photos img"
    ],
    "brand": [
      ".brand",
      "[itemprop='brand']",
      ".product-brand",
      "[data-brand]"
    ]
  }
}
```

### 2. Fetch Configuration

The universal parser needs to know when to use different fetch strategies:

```javascript
// In universal-parser.js constructor
this.fetchConfig = {
  // Sites that need browser rendering
  requiresBrowser: [
    'farfetch.com',
    'ssense.com',
    'net-a-porter.com',
    'cultgaia.com',
    'matchesfashion.com'
  ],

  // Sites that need proxy (when proxy is fixed)
  requiresProxy: [
    'cos.com',
    'arket.com',
    'stories.com'
  ],

  // Sites with strict bot protection
  requiresSpecialHeaders: {
    'nike.com': {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
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
```

### 3. Field Normalization Rules

Different sites use different formats. Configure how to normalize:

```javascript
// In universal-parser.js
this.normalization = {
  price: {
    // Remove currency symbols and convert to number
    currencies: ['$', '£', '€', '¥', 'USD', 'EUR', 'GBP'],
    decimal: '.',
    thousands: ','
  },

  images: {
    // Transform image URLs to high quality
    transforms: {
      'shopify.com': (url) => url.replace(/_\d+x\d+/, '_2048x2048'),
      'zara.com': (url) => url.replace(/w=\d+/, 'w=1920'),
      'hm.com': (url) => url.replace(/call=url\[file:.+?\]/, 'call=url[file:/product/main]')
    },

    // Maximum images to return
    maxImages: 10,

    // Minimum image dimensions
    minWidth: 200,
    minHeight: 200
  },

  brand: {
    // Known brand mappings
    mappings: {
      'cos': 'COS',
      'hm': 'H&M',
      'zara': 'Zara',
      'stories': '& Other Stories'
    }
  }
};
```

### 4. Confidence Scoring Weights

Adjust how confidence is calculated:

```javascript
this.confidenceWeights = {
  // Field importance (must sum to 1.0)
  fields: {
    name: 0.25,
    price: 0.25,
    images: 0.20,
    brand: 0.15,
    description: 0.15
  },

  // Source reliability bonus
  sourceBonus: {
    jsonLd: 0.3,      // Most reliable
    openGraph: 0.2,   // Very reliable
    microdata: 0.15,  // Reliable
    patterns: 0.1,    // Learned patterns
    generic: 0        // No bonus
  },

  // Minimum threshold to use universal result
  minimumConfidence: parseFloat(process.env.UNIVERSAL_CONFIDENCE || '0.7')
};
```

### 5. Monitoring Configuration

Track performance metrics:

```javascript
// Create metrics.json
{
  "enabled": true,
  "logFile": "./logs/universal-parser.log",
  "metricsFile": "./metrics/daily.json",
  "track": {
    "success_rate": true,
    "confidence_scores": true,
    "response_times": true,
    "fallback_usage": true,
    "field_extraction_rate": true,
    "error_types": true
  },
  "alerts": {
    "success_rate_below": 0.7,
    "avg_confidence_below": 0.6,
    "response_time_above": 3000
  }
}
```

## Server Integration Configuration

### In `server.js`, add configuration:

```javascript
// At the top of server.js
const universalConfig = {
  enabled: process.env.UNIVERSAL_MODE !== 'off',
  mode: process.env.UNIVERSAL_MODE || 'shadow',
  logLevel: process.env.UNIVERSAL_LOG_LEVEL || 'normal',
  caching: {
    enabled: true,
    ttl: parseInt(process.env.UNIVERSAL_CACHE_TTL || '3600')
  }
};

// Conditional loading
if (universalConfig.enabled) {
  console.log(`🧠 Universal Parser Mode: ${universalConfig.mode}`);
}
```

## Testing Configuration

### Test with different modes:

```bash
# Test in shadow mode (safe)
UNIVERSAL_MODE=shadow npm start

# Test on specific sites only
UNIVERSAL_MODE=partial UNIVERSAL_SITES=zara.com,hm.com npm start

# Test with low confidence (more universal usage)
UNIVERSAL_CONFIDENCE=0.5 npm start

# Test with high confidence (more fallback usage)
UNIVERSAL_CONFIDENCE=0.9 npm start

# Disable completely
UNIVERSAL_MODE=off npm start
```

## Performance Tuning

### Cache Configuration
```javascript
// In universal-parser.js
this.cache = new Map();
this.cacheConfig = {
  enabled: true,
  ttl: 3600000,  // 1 hour
  maxSize: 100,  // Maximum cached URLs

  // Cache key includes these parameters
  keyParams: ['url', 'mode', 'timestamp_hour']
};
```

### Parallel Extraction
```javascript
// Run all strategies in parallel for speed
async parseParallel(url) {
  const [jsonLd, openGraph, microdata, patterns, generic] = await Promise.all([
    this.extractJsonLd($).catch(() => ({})),
    this.extractOpenGraph($).catch(() => ({})),
    this.extractMicrodata($).catch(() => ({})),
    this.extractWithPatterns($, hostname).catch(() => ({})),
    this.extractGeneric($).catch(() => ({}))
  ]);

  return this.mergeStrategies({ jsonLd, openGraph, microdata, patterns, generic });
}
```

## Debugging Configuration

Enable detailed logging:

```javascript
// Debug mode
if (process.env.UNIVERSAL_LOG_LEVEL === 'verbose') {
  console.log('🔍 Extraction details:', {
    url,
    strategies_attempted: ['jsonLd', 'openGraph', 'microdata', 'patterns', 'generic'],
    results_per_strategy: strategies,
    merged_result: merged,
    confidence_calculation: {
      base: baseScore,
      bonuses: bonuses,
      final: confidence
    }
  });
}
```

## Default Behavior

If NO configuration is provided, the universal parser should:
1. Run in `shadow` mode (safe)
2. Use 0.7 confidence threshold
3. Cache for 1 hour
4. Log normal level
5. Learn patterns
6. Not break anything

This ensures safe operation even without configuration.