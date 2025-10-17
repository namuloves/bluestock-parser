# Universal Parser V3: Lean Implementation Plan

## Core Principles
- **Delete > Maintain** - Remove brittle auto-learning, fuzzy confidence scores
- **Deterministic > Probabilistic** - Hard pass/fail gates, no guessing
- **Declarative > Imperative** - Selector recipes over code scrapers
- **Contract-First** - JSON Schema validation, not confidence scores
- **Fail Fast** - Circuit breakers, strict timeouts, no retries

## Architecture Overview

```
URL → Page Type Detection → Extraction Pipeline → Quality Gate → Pass/Fail
         ↓                          ↓
    (Skip if not product)    [Plugins: jsonld, microdata,
                              opengraph, recipes, semantic]
```

## 1. Quality Gate (Replace Confidence Scores)

### Product Schema Contract
```javascript
const ProductSchema = {
  type: 'object',
  required: ['name', 'price', 'images'],
  properties: {
    name: {
      type: 'string',
      minLength: 3,
      pattern: '^(?!.*undefined).*$'  // No placeholder text
    },
    price: {
      type: 'number',
      minimum: 0,
      maximum: 1000000  // Sanity check
    },
    images: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        format: 'uri'
      }
    },
    currency: {
      type: 'string',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
    },
    brand: { type: 'string', minLength: 1 }
  }
};

// Usage: Hard pass/fail
function qualityGate(product) {
  const valid = ajv.validate(ProductSchema, product);
  if (!valid) {
    throw new ValidationError(ajv.errors);
  }

  // Additional business rules
  if (product.name === product.brand) {
    throw new ValidationError('Name and brand identical');
  }
  if (product.price > 50000) {
    throw new ValidationError('Price suspiciously high');
  }

  return product;
}
```

## 2. Selector Recipes (Kill pattern-db.json)

### `/recipes/zara.com.yml`
```yaml
domain: zara.com
last_validated: 2024-01-18
selectors:
  name:
    selector: h1.product-detail-info__header-name
    type: text
    required: true
  price:
    selector: .product-price-current span
    type: price
    required: true
    transform: extractNumber
  images:
    selector: .media-image__image
    type: images
    attribute: src
    min: 1
assertions:
  - price > 0
  - price < 10000
  - name != description
  - images.length >= 1
  - images[0].startsWith('https')
render_required: false
```

### Recipe Loader with Tests
```javascript
class RecipeExtractor {
  constructor() {
    this.recipes = this.loadRecipes('./recipes/');
  }

  loadRecipes(dir) {
    const recipes = {};
    fs.readdirSync(dir).forEach(file => {
      const domain = path.basename(file, '.yml');
      const recipe = yaml.load(fs.readFileSync(file));

      // Validate recipe structure
      if (!recipe.selectors || !recipe.domain) {
        throw new Error(`Invalid recipe: ${file}`);
      }

      recipes[domain] = recipe;
    });
    return recipes;
  }

  extract($, domain) {
    const recipe = this.recipes[domain];
    if (!recipe) return null;

    const result = {};

    // Extract using selectors
    for (const [field, config] of Object.entries(recipe.selectors)) {
      const value = this.extractField($, config);
      if (config.required && !value) {
        throw new Error(`Required field missing: ${field}`);
      }
      if (value) result[field] = value;
    }

    // Run assertions
    for (const assertion of recipe.assertions || []) {
      if (!eval(assertion)) {  // Safe eval with sandbox
        throw new Error(`Assertion failed: ${assertion}`);
      }
    }

    return result;
  }
}
```

## 3. Unified Plugin Interface

```javascript
// Base interface for all extractors
class ExtractionPlugin {
  name = 'base';
  priority = 0;  // Higher = try first

  canHandle($, url, pageType) {
    return true;  // Override in subclasses
  }

  async extract($, url) {
    return {};  // Returns partial product data
  }
}

// Implementations
class JsonLdPlugin extends ExtractionPlugin {
  name = 'jsonld';
  priority = 100;

  canHandle($) {
    return $('script[type="application/ld+json"]').length > 0;
  }

  extract($) {
    const data = {};
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json['@type'] === 'Product') {
          data.name = json.name;
          data.price = parseFloat(json.offers?.price);
          data.currency = json.offers?.priceCurrency;
          data.images = Array.isArray(json.image) ? json.image : [json.image];
          data.brand = json.brand?.name || json.brand;
        }
      } catch (e) {}
    });
    return data;
  }
}

class RecipePlugin extends ExtractionPlugin {
  name = 'recipe';
  priority = 90;

  constructor() {
    super();
    this.recipeExtractor = new RecipeExtractor();
  }

  canHandle($, url) {
    const domain = new URL(url).hostname.replace('www.', '');
    return this.recipeExtractor.recipes[domain] !== undefined;
  }

  extract($, url) {
    const domain = new URL(url).hostname.replace('www.', '');
    return this.recipeExtractor.extract($, domain);
  }
}

// Plugin Manager
class PluginPipeline {
  constructor() {
    this.plugins = [
      new JsonLdPlugin(),
      new MicrodataPlugin(),
      new OpenGraphPlugin(),
      new RecipePlugin(),
      new SemanticSelectorsPlugin()
    ].sort((a, b) => b.priority - a.priority);
  }

  async extract($, url, pageType) {
    const results = [];

    for (const plugin of this.plugins) {
      if (plugin.canHandle($, url, pageType)) {
        try {
          const data = await plugin.extract($, url);
          if (data && Object.keys(data).length > 0) {
            results.push({
              plugin: plugin.name,
              data,
              fields: Object.keys(data)
            });
          }
        } catch (e) {
          console.log(`Plugin ${plugin.name} failed:`, e.message);
        }
      }
    }

    return this.merge(results);
  }

  merge(results) {
    // Deterministic merging - first valid value wins
    const merged = {};
    const fields = ['name', 'price', 'currency', 'images', 'brand'];

    for (const field of fields) {
      for (const result of results) {
        if (result.data[field] !== undefined && result.data[field] !== null) {
          merged[field] = result.data[field];
          merged[`_${field}_source`] = result.plugin;
          break;
        }
      }
    }

    return merged;
  }
}
```

## 4. Smart Rendering Policy

```javascript
class RenderPolicy {
  constructor() {
    this.patterns = {
      // SPA indicators
      spa: [
        'react-root', '__NEXT_DATA__', 'vue-app',
        'angular-app', 'ember-application'
      ],
      // Product page indicators
      product: [
        'product-detail', 'pdp-container', 'product-info',
        /\/product\//i, /\/p\//i, /\/item\//i
      ]
    };
  }

  shouldRender($, url, html) {
    // Check if it's even a product page
    if (!this.isProductPage($, url, html)) {
      return false;
    }

    // Check for SPA markers
    if (this.isSPA($, html)) {
      return true;
    }

    // Check if critical data is missing
    if (this.hasCriticalData($)) {
      return false;  // Already have data, skip render
    }

    return true;
  }

  isProductPage($, url, html) {
    const urlMatch = this.patterns.product.some(p =>
      typeof p === 'string' ? url.includes(p) : p.test(url)
    );

    const htmlMatch = html.includes('product') ||
                      $('[itemtype*="Product"]').length > 0 ||
                      $('script[type="application/ld+json"]:contains("Product")').length > 0;

    return urlMatch || htmlMatch;
  }

  isSPA($, html) {
    return this.patterns.spa.some(marker => html.includes(marker));
  }

  hasCriticalData($) {
    const hasJsonLd = $('script[type="application/ld+json"]:contains("Product")').length > 0;
    const hasMicrodata = $('[itemtype*="Product"]').length > 0;
    const hasPrice = $('[data-price], .price, .product-price').length > 0;

    return hasJsonLd || (hasMicrodata && hasPrice);
  }
}

// Usage with strict limits
async function fetchWithPolicy(url, policy) {
  const html = await fetch(url, { timeout: 5000 }).then(r => r.text());
  const $ = cheerio.load(html);

  if (!policy.shouldRender($, url, html)) {
    return { $, rendered: false };
  }

  // Render with strict limits
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  // Block unnecessary resources
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 10000  // 10s max
  });

  const content = await page.content();
  await page.close();

  return { $: cheerio.load(content), rendered: true };
}
```

## 5. Per-Domain Policies

### `/policies/domains.yml`
```yaml
defaults:
  user_agent: "Mozilla/5.0 (compatible; Bluestock/1.0)"
  timeout: 5000
  rate_limit: 10  # requests per second
  render_budget: 100  # renders per hour
  circuit_breaker:
    failure_threshold: 5
    reset_timeout: 60000

domains:
  zara.com:
    render_required: false
    timeout: 3000
    rate_limit: 5

  shein.com:
    render_required: true
    timeout: 15000
    rate_limit: 2
    render_budget: 50

  # Problematic site
  slowsite.com:
    timeout: 2000
    rate_limit: 1
    circuit_breaker:
      failure_threshold: 2
```

### Policy Enforcer
```javascript
class DomainPolicy {
  constructor(configPath) {
    this.config = yaml.load(fs.readFileSync(configPath));
    this.breakers = {};
    this.rateLimiters = {};
  }

  getPolicy(domain) {
    return {
      ...this.config.defaults,
      ...this.config.domains[domain]
    };
  }

  async execute(domain, fn) {
    const policy = this.getPolicy(domain);

    // Check circuit breaker
    if (this.breakers[domain]?.isOpen()) {
      throw new Error(`Circuit breaker open for ${domain}`);
    }

    // Check rate limit
    await this.rateLimiters[domain]?.acquire();

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), policy.timeout)
        )
      ]);

      this.breakers[domain]?.success();
      return result;

    } catch (error) {
      this.breakers[domain]?.failure();
      throw error;
    }
  }
}
```

## 6. Golden Dataset Testing

### `/test/golden-products.json`
```json
[
  {
    "url": "https://www.zara.com/us/en/ribbed-tank-top-p04174304.html",
    "expected": {
      "name": "RIBBED TANK TOP",
      "price": 17.90,
      "currency": "USD",
      "brand": "ZARA",
      "images_min": 4
    }
  },
  {
    "url": "https://fredhome.com/some-product",
    "expected": {
      "name_regex": ".*",
      "price_min": 10,
      "price_max": 5000,
      "images_min": 1
    }
  }
]
```

### Contract Test Runner
```javascript
class GoldenTest {
  constructor(goldenPath) {
    this.golden = JSON.parse(fs.readFileSync(goldenPath));
    this.parser = new UniversalParser();
  }

  async runAll() {
    const results = [];

    for (const test of this.golden) {
      try {
        const product = await this.parser.parse(test.url);
        const valid = this.validate(product, test.expected);

        results.push({
          url: test.url,
          passed: valid,
          product
        });

      } catch (error) {
        results.push({
          url: test.url,
          passed: false,
          error: error.message
        });
      }
    }

    const passRate = results.filter(r => r.passed).length / results.length;

    if (passRate < 0.95) {  // 95% SLO
      throw new Error(`Golden test failed: ${passRate * 100}% pass rate`);
    }

    return results;
  }

  validate(product, expected) {
    for (const [key, value] of Object.entries(expected)) {
      if (key.endsWith('_regex')) {
        const field = key.replace('_regex', '');
        if (!new RegExp(value).test(product[field])) return false;

      } else if (key.endsWith('_min')) {
        const field = key.replace('_min', '');
        const val = field === 'images' ? product[field]?.length : product[field];
        if (val < value) return false;

      } else if (key.endsWith('_max')) {
        const field = key.replace('_max', '');
        if (product[field] > value) return false;

      } else {
        if (product[key] !== value) return false;
      }
    }
    return true;
  }
}

// CI Integration
// package.json scripts:
"scripts": {
  "test:golden": "node test/golden-test.js",
  "precommit": "npm run test:golden"
}
```

## 7. Lean Observability

```javascript
class Metrics {
  constructor() {
    this.counters = {
      success: 0,
      gate_fail: 0,
      render_used: 0,
      breaker_open: 0
    };

    this.histograms = {
      latency: [],
      price_values: []
    };
  }

  record(event, value = 1) {
    if (this.counters[event] !== undefined) {
      this.counters[event] += value;
    }

    if (event === 'latency') {
      this.histograms.latency.push(value);
      // Keep only last 1000
      if (this.histograms.latency.length > 1000) {
        this.histograms.latency.shift();
      }
    }
  }

  getSnapshot() {
    return {
      counters: { ...this.counters },
      success_rate: this.counters.success /
                    (this.counters.success + this.counters.gate_fail),
      p95_latency: this.percentile(this.histograms.latency, 0.95),
      render_rate: this.counters.render_used / this.counters.success
    };
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

// Structured logging
function logExtraction(url, result, metrics) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    url,
    success: result.success,
    gate_fail_reason: result.error?.type,
    latency_ms: result.latency,
    rendered: result.rendered,
    plugin_used: result.plugin,
    price: result.product?.price,
    metrics: metrics.getSnapshot()
  }));
}
```

## 8. Image Pipeline Fix

```javascript
class ImageHandler {
  constructor() {
    this.cdnPatterns = [
      /bunnycdn\.com/,
      /cloudinary\.com/,
      /imgix\.net/
    ];
  }

  processImages(images, sourceUrl) {
    if (!images || images.length === 0) return [];

    return images.map(img => {
      // Store original URL
      const original = this.resolveUrl(img, sourceUrl);

      // Check if it's already CDN-transformed
      const isCdn = this.cdnPatterns.some(p => p.test(original));

      return {
        original,
        cdn: isCdn ? original : null,
        should_download: !isCdn && this.isReachable(original),
        timestamp: Date.now()
      };
    });
  }

  resolveUrl(img, baseUrl) {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    if (img.startsWith('//')) return 'https:' + img;
    if (img.startsWith('/')) {
      const url = new URL(baseUrl);
      return url.origin + img;
    }
    return new URL(img, baseUrl).href;
  }

  async isReachable(url) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        timeout: 2000
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

## 9. Main Parser State Machine

```javascript
class UniversalParserV3 {
  constructor(config) {
    this.pipeline = new PluginPipeline();
    this.renderPolicy = new RenderPolicy();
    this.domainPolicy = new DomainPolicy(config.policyPath);
    this.imageHandler = new ImageHandler();
    this.metrics = new Metrics();
  }

  async parse(url) {
    const startTime = Date.now();
    const domain = new URL(url).hostname.replace('www.', '');

    try {
      // Step 1: Apply domain policy
      const result = await this.domainPolicy.execute(domain, async () => {

        // Step 2: Fetch with render decision
        const { $, rendered } = await this.fetchWithPolicy(url);
        this.metrics.record('render_used', rendered ? 1 : 0);

        // Step 3: Extract via plugins
        const pageType = this.detectPageType($, url);
        if (pageType !== 'product') {
          throw new Error('Not a product page');
        }

        const extracted = await this.pipeline.extract($, url, pageType);

        // Step 4: Process images
        extracted.images = this.imageHandler.processImages(
          extracted.images,
          url
        );

        // Step 5: Quality gate
        const product = this.qualityGate(extracted);

        return {
          product,
          rendered,
          plugin: extracted._name_source,
          latency: Date.now() - startTime
        };
      });

      this.metrics.record('success');
      this.metrics.record('latency', result.latency);

      return {
        success: true,
        ...result
      };

    } catch (error) {
      this.metrics.record('gate_fail');

      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name
        },
        latency: Date.now() - startTime
      };
    }
  }

  detectPageType($, url) {
    // Simple heuristics
    if (url.includes('/product/') || url.includes('/p/')) {
      return 'product';
    }
    if ($('[itemtype*="Product"]').length > 0) {
      return 'product';
    }
    if (url.includes('/category/') || url.includes('/search/')) {
      return 'listing';
    }
    return 'unknown';
  }

  qualityGate(data) {
    const schema = ProductSchema;
    const valid = ajv.validate(schema, data);

    if (!valid) {
      throw new ValidationError(ajv.errors);
    }

    // Additional business rules
    const rules = [
      { check: () => data.price > 0, error: 'Price must be positive' },
      { check: () => data.name.length > 2, error: 'Name too short' },
      { check: () => !data.name.includes('undefined'), error: 'Name has placeholder' },
      { check: () => data.images[0].startsWith('http'), error: 'Invalid image URL' }
    ];

    for (const rule of rules) {
      if (!rule.check()) {
        throw new ValidationError(rule.error);
      }
    }

    return data;
  }
}
```

## Migration Path

### Week 1: Parallel Testing
```bash
# Run both parsers, compare results
PARSER_MODE=shadow npm start
```

### Week 2: Gradual Rollout
```bash
# Enable for specific domains
PARSER_V3_DOMAINS=zara.com,hm.com npm start
```

### Week 3: Full Migration
```bash
# V3 primary, V2 fallback
PARSER_MODE=v3_primary npm start
```

## Key Differences from Current Plan

| Current Approach | Lean Approach |
|-----------------|---------------|
| Fuzzy confidence scores (0.7) | Hard quality gate (pass/fail) |
| Auto-learning pattern-db.json | Versioned selector recipes |
| Multiple extraction attempts | Single plugin pipeline |
| Always try rendering | Smart render detection |
| Unlimited retries | Circuit breakers + timeouts |
| Store CDN URLs | Store original URLs |
| Heavy logging | Structured metrics |
| 550 lines of complex code | ~300 lines modular plugins |

## Success Metrics
- **Pass rate**: >95% on golden dataset
- **P95 latency**: <2s (non-rendered), <10s (rendered)
- **Render rate**: <20% of requests
- **Cost**: 50% reduction via smart rendering
- **Maintenance**: Recipe updates vs code changes

## What Gets Deleted
- pattern-db.json auto-learning
- Confidence calculation (230+ lines)
- Retry logic
- Complex merging strategies
- saveSuccessfulPatterns()

## What's New
- JSON Schema validation
- Declarative selector recipes
- Circuit breakers
- Golden dataset CI tests
- Structured metrics
- Image deduplication