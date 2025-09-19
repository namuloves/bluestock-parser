const UniversalParserV3Cached = require('./universal-parser-v3-cached');
const { DomainRetryHandler } = require('./utils/retry-handler');

class UniversalParserV3Resilient extends UniversalParserV3Cached {
  constructor() {
    super();
    this.retryHandler = new DomainRetryHandler();

    // Fallback chain configuration
    this.fallbackChain = [
      'direct',      // Try direct fetch first (fastest)
      'puppeteer',   // Try Puppeteer if direct fails
      'proxy',       // Try with proxy if still failing
      'dedicated'    // Fall back to dedicated scraper if exists
    ];
  }

  async parse(url) {
    const hostname = new URL(url).hostname.replace('www.', '');

    // Check cache first (including Redis)
    const cached = await this.checkAllCaches(url);
    if (cached) return cached;

    // Execute with retry logic
    return await this.retryHandler.executeWithRetry(
      async () => await this.parseWithFallbackChain(url),
      url
    );
  }

  async parseWithFallbackChain(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    let lastError = null;
    let result = null;

    // Try each strategy in the fallback chain
    for (const strategy of this.fallbackChain) {
      if (this.logLevel === 'verbose') {
        console.log(`🔄 Trying strategy: ${strategy} for ${hostname}`);
      }

      try {
        switch (strategy) {
          case 'direct':
            // Skip if site is known to block direct
            if (this.blocksDirectFetch.has(hostname)) continue;
            result = await this.parseWithDirect(url);
            break;

          case 'puppeteer':
            result = await this.parseWithPuppeteer(url);
            break;

          case 'proxy':
            // Only try if proxy is configured
            if (!process.env.USE_PROXY || process.env.USE_PROXY !== 'true') continue;
            result = await this.parseWithProxy(url);
            break;

          case 'dedicated':
            // Check if dedicated scraper exists
            if (this.hasDedicatedScraper(hostname)) {
              result = await this.parseWithDedicatedScraper(url);
            }
            continue;

          default:
            continue;
        }

        // If we got a good result, return it
        if (result && result.confidence > 0.3) {
          if (this.logLevel !== 'quiet') {
            console.log(`✅ Success with ${strategy} strategy for ${hostname}`);
          }

          // Cache the successful result
          await this.cacheResult(url, result);

          return result;
        }

      } catch (error) {
        lastError = error;
        if (this.logLevel === 'verbose') {
          console.log(`⚠️ Strategy ${strategy} failed: ${error.message}`);
        }
      }
    }

    // All strategies failed
    if (lastError) {
      throw lastError;
    }

    return {
      error: 'All strategies failed',
      confidence: 0,
      url
    };
  }

  async checkAllCaches(url) {
    // Check Redis first
    const redisCached = await this.redisCache.get(url, 'v3');
    if (redisCached) {
      if (this.logLevel !== 'quiet') {
        console.log(`🔴 Redis cache HIT for ${url}`);
      }
      return redisCached;
    }

    // Check in-memory cache
    const memoryCached = this.cache.get(url);
    if (memoryCached && Date.now() - memoryCached.timestamp < 3600000) {
      if (this.logLevel === 'verbose') {
        console.log(`💾 Memory cache HIT for ${url}`);
      }
      return memoryCached.data;
    }

    return null;
  }

  async parseWithDirect(url) {
    // Implementation similar to parent but isolated for retry
    const html = await this.fetchDirect(url);
    const $ = require('cheerio').load(html);
    const result = await this.extractData($, new URL(url).hostname.replace('www.', ''), url);

    if (html.length < 5000 || !result.name) {
      throw new Error('Insufficient data from direct fetch');
    }

    return result;
  }

  async parseWithPuppeteer(url) {
    // Use parent's Puppeteer implementation
    const hostname = new URL(url).hostname.replace('www.', '');
    const { html, interceptedData } = await this.fetchWithPuppeteerAndIntercept(url, hostname);
    const $ = require('cheerio').load(html);

    let result = await this.extractData($, hostname, url);

    if (interceptedData) {
      result = this.mergeApiData(result, interceptedData);
    }

    return result;
  }

  async parseWithProxy(url) {
    // Similar to parseWithPuppeteer but with proxy enabled
    process.env.USE_PROXY = 'true';
    const result = await this.parseWithPuppeteer(url);
    process.env.USE_PROXY = 'false';
    return result;
  }

  hasDedicatedScraper(hostname) {
    // Check if dedicated scraper exists
    const dedicatedScrapers = [
      'amazon.com',
      'ebay.com',
      'zara.com',
      'nordstrom.com',
      'ssense.com',
      'farfetch.com',
      'net-a-porter.com',
      'aritzia.com',
      'cos.com',
      'hm.com'
    ];

    return dedicatedScrapers.includes(hostname);
  }

  async parseWithDedicatedScraper(url) {
    const hostname = new URL(url).hostname.replace('www.', '');

    try {
      // Dynamic import of dedicated scraper
      const scraperModule = require(`./scrapers/${hostname.split('.')[0]}`);
      const scraperFunc = scraperModule.default ||
                         scraperModule[`scrape${hostname.split('.')[0].toUpperCase()}`] ||
                         scraperModule.scrapeHTML;

      if (!scraperFunc) {
        throw new Error(`No scraper function found for ${hostname}`);
      }

      const result = await scraperFunc(url);

      // Normalize to our format
      return {
        ...result,
        confidence: 0.9, // High confidence for dedicated scrapers
        source: `dedicated-${hostname}`
      };

    } catch (error) {
      if (this.logLevel === 'verbose') {
        console.log(`⚠️ Dedicated scraper failed: ${error.message}`);
      }
      throw error;
    }
  }

  async cacheResult(url, result) {
    // Cache in Redis
    if (result && result.confidence > 0.3 && !result.error) {
      await this.redisCache.set(url, result, 'v3');
    }

    // Also cache in memory
    this.cache.set(url, {
      data: result,
      timestamp: Date.now()
    });
  }

  getRetryStatistics() {
    return this.retryHandler.getStatistics();
  }

  async getFullMetrics() {
    const parserMetrics = this.getMetrics();
    const cacheMetrics = await this.redisCache.getMetrics();
    const retryMetrics = this.getRetryStatistics();

    return {
      parser: parserMetrics,
      cache: cacheMetrics,
      retry: retryMetrics,
      resilience: {
        fallbackChainLength: this.fallbackChain.length,
        strategies: this.fallbackChain
      }
    };
  }
}

module.exports = UniversalParserV3Resilient;