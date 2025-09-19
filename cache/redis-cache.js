const Redis = require('ioredis');

class RedisCache {
  constructor(options = {}) {
    this.enabled = process.env.REDIS_ENABLED !== 'false';
    this.prefix = options.prefix || 'parser:';
    this.defaultTTL = options.ttl || 3600; // 1 hour default

    // TTL by confidence level (in seconds)
    this.ttlByConfidence = {
      high: 86400,    // 24 hours for high confidence (>0.8)
      medium: 7200,   // 2 hours for medium confidence (0.5-0.8)
      low: 1800       // 30 minutes for low confidence (<0.5)
    };

    // TTL by site (override for specific sites)
    this.ttlBySite = {
      'amazon.com': 43200,      // 12 hours - prices change frequently
      'zara.com': 7200,         // 2 hours - flash sales
      'uniqlo.com': 21600,      // 6 hours
      'ssense.com': 10800,      // 3 hours - frequent updates
      'nordstrom.com': 14400    // 4 hours
    };

    if (this.enabled) {
      this.initRedis();
    } else {
      console.log('⚠️  Redis caching disabled');
      this.client = null;
    }

    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0
    };
  }

  initRedis() {
    try {
      // Redis connection options
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3
      };

      // Support for Redis URL (for cloud services like Redis Cloud, Upstash, etc.)
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL);
      } else {
        this.client = new Redis(redisConfig);
      }

      // Event handlers
      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        this.metrics.errors++;
      });

      this.client.on('close', () => {
        console.log('📴 Redis connection closed');
      });

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error.message);
      this.enabled = false;
      this.client = null;
    }
  }

  generateKey(url, parserVersion = 'v3') {
    // Create a consistent cache key
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname + urlObj.search;

    // Include parser version in key to allow cache busting on updates
    return `${this.prefix}${parserVersion}:${hostname}:${Buffer.from(path).toString('base64')}`;
  }

  determineTTL(hostname, confidence) {
    // Check for site-specific TTL
    if (this.ttlBySite[hostname]) {
      return this.ttlBySite[hostname];
    }

    // Use confidence-based TTL
    if (confidence > 0.8) {
      return this.ttlByConfidence.high;
    } else if (confidence > 0.5) {
      return this.ttlByConfidence.medium;
    } else {
      return this.ttlByConfidence.low;
    }
  }

  async get(url, parserVersion = 'v3') {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const key = this.generateKey(url, parserVersion);
      const cached = await this.client.get(key);

      if (cached) {
        this.metrics.hits++;
        const data = JSON.parse(cached);

        // Add cache metadata
        data._cached = true;
        data._cacheTime = new Date(data._cacheTimestamp).toISOString();

        if (process.env.UNIVERSAL_LOG_LEVEL === 'verbose') {
          console.log(`📦 Cache HIT for ${url}`);
        }

        return data;
      }

      this.metrics.misses++;
      if (process.env.UNIVERSAL_LOG_LEVEL === 'verbose') {
        console.log(`📭 Cache MISS for ${url}`);
      }

      return null;

    } catch (error) {
      console.error('Redis GET error:', error.message);
      this.metrics.errors++;
      return null;
    }
  }

  async set(url, data, parserVersion = 'v3') {
    if (!this.enabled || !this.client || !data) {
      return false;
    }

    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const ttl = this.determineTTL(hostname, data.confidence || 0);
      const key = this.generateKey(url, parserVersion);

      // Add timestamp to data
      const dataToCache = {
        ...data,
        _cacheTimestamp: Date.now(),
        _ttl: ttl
      };

      await this.client.set(
        key,
        JSON.stringify(dataToCache),
        'EX',
        ttl
      );

      this.metrics.sets++;

      if (process.env.UNIVERSAL_LOG_LEVEL === 'verbose') {
        console.log(`💾 Cached for ${ttl}s: ${url}`);
      }

      return true;

    } catch (error) {
      console.error('Redis SET error:', error.message);
      this.metrics.errors++;
      return false;
    }
  }

  async delete(url, parserVersion = 'v3') {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      const key = this.generateKey(url, parserVersion);
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DELETE error:', error.message);
      return false;
    }
  }

  async flush(pattern = null) {
    if (!this.enabled || !this.client) {
      return 0;
    }

    try {
      if (!pattern) {
        // Flush all parser cache
        const keys = await this.client.keys(`${this.prefix}*`);
        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          console.log(`🧹 Flushed ${deleted} cache entries`);
          return deleted;
        }
        return 0;
      } else {
        // Flush specific pattern
        const keys = await this.client.keys(`${this.prefix}*${pattern}*`);
        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          console.log(`🧹 Flushed ${deleted} cache entries matching pattern: ${pattern}`);
          return deleted;
        }
        return 0;
      }
    } catch (error) {
      console.error('Redis FLUSH error:', error.message);
      return 0;
    }
  }

  async getMetrics() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? ((this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100).toFixed(1)
      : 0;

    // Get Redis info if connected
    let redisInfo = {};
    if (this.enabled && this.client) {
      try {
        const info = await this.client.info('memory');
        const usedMemory = info.match(/used_memory_human:(.+)/);
        const connectedClients = info.match(/connected_clients:(\d+)/);

        redisInfo = {
          memory: usedMemory ? usedMemory[1].trim() : 'unknown',
          clients: connectedClients ? connectedClients[1] : 'unknown'
        };
      } catch (e) {
        // Silent fail
      }
    }

    return {
      enabled: this.enabled,
      connected: this.client && this.client.status === 'ready',
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      errors: this.metrics.errors,
      sets: this.metrics.sets,
      hitRate: `${hitRate}%`,
      ...redisInfo
    };
  }

  async warmCache(urls) {
    // Pre-populate cache with frequently accessed URLs
    console.log(`🔥 Warming cache with ${urls.length} URLs...`);

    const results = {
      success: 0,
      failed: 0
    };

    for (const url of urls) {
      try {
        // Check if already cached
        const existing = await this.get(url);
        if (!existing) {
          console.log(`  Skipping ${url} - needs fresh fetch`);
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
      }
    }

    console.log(`✅ Cache warming complete: ${results.success} cached, ${results.failed} failed`);
    return results;
  }

  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('👋 Redis connection closed');
    }
  }
}

// Singleton instance
let cacheInstance = null;

function getCache(options = {}) {
  if (!cacheInstance) {
    cacheInstance = new RedisCache(options);
  }
  return cacheInstance;
}

module.exports = { RedisCache, getCache };