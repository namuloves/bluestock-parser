/**
 * Universal Parser LEAN
 * The new, clean, deterministic parser
 * No confidence scores, just validation
 */

const cheerio = require('cheerio');
const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Import all our new components
const { getPluginManager } = require('./plugins/PluginManager');
const { getQualityGate } = require('./utils/qualityGate');
const { getRenderPolicy } = require('./utils/renderPolicy');
const { getCircuitBreaker } = require('./utils/circuitBreaker');

class UniversalParserLean {
  constructor() {
    this.version = '4.0.0-lean';

    // Initialize components
    this.pluginManager = getPluginManager();
    this.qualityGate = getQualityGate();
    this.renderPolicy = getRenderPolicy();
    this.circuitBreaker = getCircuitBreaker();

    // Load domain policies
    this.loadDomainPolicies();

    // Cache for successful parses
    this.cache = new Map();
    this.cacheConfig = {
      ttl: 300000, // 5 minutes
      maxSize: 100
    };

    // Puppeteer instance (lazy loaded)
    this.browser = null;

    console.log(`✨ Universal Parser LEAN v${this.version} initialized`);
  }

  /**
   * Load domain policies from YAML
   */
  loadDomainPolicies() {
    try {
      const policyPath = path.join(__dirname, 'policies', 'domains.yml');
      this.policies = yaml.load(fs.readFileSync(policyPath, 'utf8'));
      console.log('📋 Loaded domain policies');
    } catch (error) {
      console.warn('⚠️ Could not load domain policies, using defaults');
      this.policies = { defaults: this.getDefaultPolicy() };
    }
  }

  /**
   * Get default policy
   */
  getDefaultPolicy() {
    return {
      user_agent: 'Mozilla/5.0 (compatible; Bluestock/2.0)',
      timeout: 5000,
      rate_limit: 10,
      render_budget: 100,
      circuit_breaker: {
        failure_threshold: 5,
        reset_timeout: 60000
      }
    };
  }

  /**
   * Get policy for a domain
   */
  getDomainPolicy(domain) {
    // Check if domain is blocked
    const blocked = this.policies.blocked?.find(b => b.domain === domain);
    if (blocked) {
      throw new Error(`Domain blocked: ${blocked.reason}`);
    }

    // Find specific policy
    const allPolicies = [
      ...(this.policies.reliable || []),
      ...(this.policies.special || []),
      ...(this.policies.problematic || []),
      ...(this.policies.rate_limited || [])
    ];

    const specific = allPolicies.find(p => p.domain === domain);

    return {
      ...this.policies.defaults,
      ...(specific || {})
    };
  }

  /**
   * Main parse function
   */
  async parse(url, options = {}) {
    const startTime = Date.now();
    const domain = this.getDomain(url);

    console.log(`\n🚀 Parsing ${domain} with LEAN parser v${this.version}`);

    // Check cache
    const cached = this.getCached(url);
    if (cached && !options.bypassCache) {
      console.log('💾 Returning cached result');
      return cached;
    }

    try {
      // Get domain policy
      const policy = this.getDomainPolicy(domain);

      // Execute with circuit breaker
      const result = await this.circuitBreaker.execute(domain, async () => {
        return await this.parseWithPolicy(url, policy, options);
      }, { timeout: policy.timeout });

      // Cache successful result
      if (result.success) {
        this.setCached(url, result);
      }

      // Add metadata
      result.metadata = {
        parser_version: this.version,
        duration_ms: Date.now() - startTime,
        domain,
        timestamp: new Date().toISOString()
      };

      return result;

    } catch (error) {
      console.error(`❌ Parse failed for ${domain}:`, error.message);

      return {
        success: false,
        error: error.message,
        domain,
        metadata: {
          parser_version: this.version,
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Parse with domain policy
   */
  async parseWithPolicy(url, policy, options) {
    // Step 1: Fetch HTML
    const { html, $, rendered } = await this.fetchWithPolicy(url, policy, options);

    // Step 2: Extract with plugins
    const extracted = await this.pluginManager.extract($, url, { policy });

    // Step 2.5: Shopify enrichment - the /products/<handle>.json endpoint is the
    // most reliable source for the full image set and the vendor (brand)
    await this.enrichFromShopifyJson(url, $, extracted);

    // Step 3: Validate with Quality Gate - but be SMART about it
    const validation = this.qualityGate.validate(extracted);

    if (!validation.valid) {
      console.log(`⚠️ Quality Gate validation failed: ${validation.errors.map(e => e.message || e).join(', ')}`);

      // If we have SOME data, try to work with it
      if (extracted.name || extracted.title || extracted.product_name) {
        console.log(`🔧 Attempting recovery with partial data...`);

        // Try to fix/normalize the data
        const recovered = this.recoverPartialData(extracted);
        const revalidation = this.qualityGate.validate(recovered);

        if (revalidation.valid || (recovered.name && recovered.price)) {
          console.log(`✅ Recovery successful!`);
          return {
            success: true,
            product: revalidation.valid ? revalidation.product : recovered,
            warnings: [...(validation.warnings || []), { message: 'Recovered from partial extraction' }],
            rendered,
            extraction_method: 'lean_parser_recovered'
          };
        }
      }

      // If still no luck and haven't tried rendering, maybe try that
      if (!rendered && !options.skipRender) {
        console.log(`🌐 Attempting with browser rendering...`);
        return this.parseWithPolicy(url, policy, { ...options, forceRender: true });
      }

      return {
        success: false,
        errors: validation.errors,
        partial_data: extracted,
        rendered,
        extraction_method: 'lean_parser'
      };
    }

    // Step 4: Return validated product
    console.log(`✅ Quality Gate passed`);

    if (validation.warnings?.length > 0) {
      console.log(`⚠️ Warnings: ${validation.warnings.map(w => w.message).join(', ')}`);
    }

    return {
      success: true,
      product: validation.product,
      warnings: validation.warnings,
      rendered,
      extraction_method: 'lean_parser',
      plugins_used: extracted._extraction_metadata?.plugins_used || []
    };
  }

  /**
   * Enrich extracted data from the Shopify product JSON endpoint.
   * Works for any Shopify store (including unknown domains): grabs the full
   * image set and the vendor field, which is the actual brand/merchant on
   * multi-brand boutiques where og:site_name is just the store name.
   */
  async enrichFromShopifyJson(url, $, extracted) {
    let jsonUrl;
    try {
      const u = new URL(url);
      const match = u.pathname.match(/\/products\/([^/?#]+)/);
      if (!match) return; // Not a Shopify-style product URL
      const handle = match[1].replace(/\.json$/, '');
      jsonUrl = `${u.origin}/products/${handle}.json`;
    } catch {
      return;
    }

    try {
      console.log(`🛍️ Shopify enrichment: ${jsonUrl}`);
      const resp = await axios.get(jsonUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.policies?.defaults?.user_agent || 'Mozilla/5.0 (compatible; ProductScraper/1.0)'
        },
        timeout: 8000,
        validateStatus: s => s === 200
      });
      const product = resp.data?.product;
      if (!product) return;

      // Images: prefer the JSON API set if it has more than what plugins found
      const apiImages = (product.images || [])
        .map(img => (typeof img === 'string' ? img : (img.src || img.url)))
        .filter(Boolean);
      if (apiImages.length > (extracted.images?.length || 0)) {
        extracted.images = apiImages;
      }

      // Brand: vendor is authoritative on Shopify. Override when brand is
      // missing or when plugins picked up the store name instead of the brand.
      const siteName = ($('meta[property="og:site_name"]').attr('content') || '').trim().toLowerCase();
      const currentBrand = (extracted.brand || '').trim().toLowerCase();
      if (product.vendor && (!currentBrand || currentBrand === siteName)) {
        extracted.brand = product.vendor.trim();
      }

      // Fallbacks for other fields
      if (!extracted.name && product.title) extracted.name = product.title;
      if (!extracted.price && product.variants?.[0]?.price) {
        extracted.price = this.parsePrice(product.variants[0].price);
      }

      console.log(`✅ Shopify enrichment: ${apiImages.length} images, vendor: ${product.vendor || 'n/a'}`);
    } catch (e) {
      console.log(`⚠️ Shopify enrichment skipped: ${e.message}`);
    }
  }

  /**
   * Recover partial data by filling in missing fields
   */
  recoverPartialData(data) {
    const recovered = { ...data };

    // Fix name field
    if (!recovered.name) {
      recovered.name = recovered.title || recovered.product_name ||
                      recovered.og_title || recovered.heading || 'Unknown Product';
    }

    // Fix price field - try to extract from any price-like field
    if (!recovered.price) {
      recovered.price = recovered.sale_price || recovered.regular_price ||
                       recovered.current_price || recovered.amount ||
                       this.findPriceInData(recovered) || 0;
    }

    // Fix images - gather from any image field
    if (!recovered.images || recovered.images.length === 0) {
      recovered.images = recovered.image_urls || recovered.photos ||
                        recovered.pictures || recovered.gallery ||
                        (recovered.image ? [recovered.image] : []) ||
                        (recovered.og_image ? [recovered.og_image] : []) || [];
    }

    // Ensure currency
    if (!recovered.currency) {
      recovered.currency = 'USD'; // Default to USD if not found
    }

    // Clean up the data
    if (recovered.name && typeof recovered.name === 'string') {
      recovered.name = recovered.name.trim();
    }

    if (recovered.price && typeof recovered.price === 'string') {
      recovered.price = this.parsePrice(recovered.price);
    }

    return recovered;
  }

  /**
   * Find price in any field of the data
   */
  findPriceInData(data) {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('price') && value) {
        const parsed = this.parsePrice(value);
        if (parsed > 0) return parsed;
      }
    }
    return null;
  }

  /**
   * Parse price from various formats
   */
  parsePrice(value) {
    if (typeof value === 'number') return value;
    if (!value) return null;

    const str = String(value);
    const match = str.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /**
   * Fetch HTML with smart rendering decision
   */
  async fetchWithPolicy(url, policy, options) {
    // First, try static fetch
    console.log('📄 Fetching static HTML...');

    const response = await axios.get(url, {
      headers: {
        'User-Agent': policy.user_agent || this.policies.defaults.user_agent,
        ...(policy.headers || {})
      },
      timeout: policy.timeout,
      maxRedirects: 5
    });

    const html = response.data;
    let $ = cheerio.load(html);

    // Check if rendering is needed
    const renderDecision = await this.renderPolicy.shouldRender(url, html, $);

    if (renderDecision.shouldRender || policy.render_required || options.forceRender) {
      console.log(`🌐 Rendering required: ${renderDecision.reason || 'Policy requirement'}`);

      if (options.skipRender) {
        console.log('⏭️ Rendering skipped (option set)');
        return { html, $, rendered: false };
      }

      // Render with Puppeteer
      const renderedHtml = await this.renderPage(url, policy);
      $ = cheerio.load(renderedHtml);

      return { html: renderedHtml, $, rendered: true };
    }

    console.log(`⏭️ Static extraction sufficient: ${renderDecision.reason}`);
    return { html, $, rendered: false };
  }

  /**
   * Render page with Puppeteer
   */
  async renderPage(url, policy) {
    // Lazy load Puppeteer
    if (!this.browser) {
      const puppeteer = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteer.use(StealthPlugin());

      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }

    const page = await this.browser.newPage();

    try {
      // Set user agent
      await page.setUserAgent(policy.user_agent || this.policies.defaults.user_agent);

      // Block unnecessary resources (but keep images for product extraction)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        // Only block stylesheets, fonts, and media - keep images for product extraction
        if (['stylesheet', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate - use networkidle2 for better content loading
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: policy.timeout || 10000
      });

      // Additional wait for client-side rendered apps if specified
      if (policy.wait_for) {
        console.log(`⏳ Waiting ${policy.wait_for}ms for client-side hydration...`);
        await new Promise(r => setTimeout(r, policy.wait_for));
      }

      // Wait for critical elements if specified
      if (policy.wait_for_selector) {
        await page.waitForSelector(policy.wait_for_selector, {
          timeout: policy.wait_for || 5000  // Use wait_for as timeout if specified
        }).catch(() => {
          console.log('⚠️ Wait selector not found, continuing...');
        });
      } else {
        // Generic wait for common product selectors
        await Promise.race([
          page.waitForSelector('h1', { timeout: 3000 }),
          page.waitForSelector('[data-testid*="product"]', { timeout: 3000 }),
          page.waitForSelector('.product-info', { timeout: 3000 })
        ]).catch(() => {});
      }

      // Get content
      const content = await page.content();
      return content;

    } finally {
      await page.close();
    }
  }

  /**
   * Get domain from URL
   */
  getDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Cache management
   */
  getCached(url) {
    const cached = this.cache.get(url);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheConfig.ttl) {
        return cached.data;
      }
      this.cache.delete(url);
    }

    return null;
  }

  setCached(url, data) {
    // Enforce cache size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get parser metrics
   */
  getMetrics() {
    return {
      version: this.version,
      cache: {
        size: this.cache.size,
        maxSize: this.cacheConfig.maxSize,
        ttl: this.cacheConfig.ttl
      },
      qualityGate: this.qualityGate.getMetrics(),
      renderPolicy: this.renderPolicy.getStats(),
      circuitBreaker: this.circuitBreaker.getMetrics(),
      plugins: this.pluginManager.getPluginList()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.cache.clear();
    console.log('🧹 Parser cleaned up');
  }

  /**
   * Test the parser
   */
  async test() {
    console.log('\n🧪 Testing Universal Parser LEAN...\n');

    const testUrls = [
      'https://www.zara.com/us/en/ribbed-tank-top-p04174304.html',
      'https://www.hm.com/us/product/1234567'
    ];

    for (const url of testUrls) {
      console.log(`Testing: ${url}`);

      try {
        const result = await this.parse(url, { skipRender: true });

        if (result.success) {
          console.log(`✅ Success: ${result.product.name} - $${result.product.price}`);
        } else {
          console.log(`❌ Failed: ${result.errors?.[0] || result.error}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    const metrics = this.getMetrics();
    console.log('\n📊 Metrics:', JSON.stringify(metrics, null, 2));
  }
}

// Export singleton getter and class
let parserInstance = null;

module.exports = {
  getLeanParser: () => {
    if (!parserInstance) {
      parserInstance = new UniversalParserLean();
    }
    return parserInstance;
  },
  UniversalParserLean
};