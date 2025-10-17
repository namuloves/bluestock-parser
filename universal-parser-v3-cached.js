const UniversalParserV3 = require('./universal-parser-v3');
const { getCache } = require('./cache/redis-cache');

class UniversalParserV3Cached extends UniversalParserV3 {
  constructor() {
    super();
    this.redisCache = getCache({
      prefix: 'parser:',
      ttl: 3600
    });
    this.cacheVersion = 'v3-image-validation-v1'; // Updated: validates image URLs, filters out invalid ones
  }

  async parse(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const cacheVersion = this.cacheVersion || 'v3';

    // Check Redis cache first (before in-memory cache)
    const redisCached = await this.redisCache.get(url, cacheVersion);
    if (redisCached) {
      if (this.logLevel !== 'quiet') {
        console.log(`🔴 Redis cache HIT for ${hostname}`);
      }
      return redisCached;
    }

    // Fall back to parent parse method (which checks memory cache)
    const result = await super.parse(url);

    // Cache successful results in Redis
    if (result && result.confidence > 0.3 && !result.error) {
      await this.redisCache.set(url, result, cacheVersion);
    }

    return result;
  }

  async getCacheMetrics() {
    const parserMetrics = this.getMetrics();
    const cacheMetrics = await this.redisCache.getMetrics();

    return {
      parser: parserMetrics,
      cache: cacheMetrics
    };
  }

  async warmCache(popularProducts) {
    console.log('🔥 Warming cache with popular products...');

    const results = {
      success: 0,
      failed: 0,
      cached: 0
    };

    for (const url of popularProducts) {
      // Check if already cached
      const cached = await this.redisCache.get(url);
      if (cached) {
        results.cached++;
        continue;
      }

      // Parse and cache
      try {
        const data = await this.parse(url);
        if (data && data.confidence > 0.3) {
          results.success++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Cache warming complete:`, results);
    return results;
  }

  async clearCache(pattern = null) {
    const deleted = await this.redisCache.flush(pattern);
    console.log(`🧹 Cleared ${deleted} cache entries`);
    return deleted;
  }

  async cleanup() {
    await super.cleanup();
    // Don't close Redis - it's a singleton that might be used elsewhere
  }
}

module.exports = UniversalParserV3Cached;
