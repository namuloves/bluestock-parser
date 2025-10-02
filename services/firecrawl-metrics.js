/**
 * Firecrawl Metrics Service
 * Tracks performance of V1 vs V2 parsers for A/B testing
 */
class FirecrawlMetrics {
  constructor() {
    this.metrics = {
      v1: {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
        accuracy: [],
        cacheHits: 0,
        errors: []
      },
      v2: {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
        accuracy: [],
        cacheHits: 0,
        errors: []
      },
      sites: {},
      lastReset: new Date().toISOString()
    };
  }

  /**
   * Record a scraping attempt
   */
  recordAttempt(version, url, startTime, result) {
    const v = version === 'v2' ? 'v2' : 'v1';
    const duration = Date.now() - startTime;
    const hostname = new URL(url).hostname.toLowerCase();

    // Update version metrics
    this.metrics[v].attempts++;

    if (result.success) {
      this.metrics[v].successes++;

      // Track accuracy (confidence score)
      if (result.product?.confidence) {
        this.metrics[v].accuracy.push(result.product.confidence);
      }

      // Track cache hits
      if (result.fromCache) {
        this.metrics[v].cacheHits++;
      }
    } else {
      this.metrics[v].failures++;
      this.metrics[v].errors.push({
        url,
        error: result.error,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 errors
      if (this.metrics[v].errors.length > 10) {
        this.metrics[v].errors.shift();
      }
    }

    // Update timing
    this.metrics[v].totalTime += duration;
    this.metrics[v].avgTime = Math.round(
      this.metrics[v].totalTime / this.metrics[v].attempts
    );

    // Update site-specific metrics
    if (!this.metrics.sites[hostname]) {
      this.metrics.sites[hostname] = {
        v1: { attempts: 0, successes: 0 },
        v2: { attempts: 0, successes: 0 }
      };
    }

    this.metrics.sites[hostname][v].attempts++;
    if (result.success) {
      this.metrics.sites[hostname][v].successes++;
    }

    return duration;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const v1SuccessRate = this.metrics.v1.attempts > 0
      ? (this.metrics.v1.successes / this.metrics.v1.attempts * 100).toFixed(1)
      : 0;

    const v2SuccessRate = this.metrics.v2.attempts > 0
      ? (this.metrics.v2.successes / this.metrics.v2.attempts * 100).toFixed(1)
      : 0;

    const v1AvgAccuracy = this.metrics.v1.accuracy.length > 0
      ? (this.metrics.v1.accuracy.reduce((a, b) => a + b, 0) / this.metrics.v1.accuracy.length).toFixed(2)
      : 0;

    const v2AvgAccuracy = this.metrics.v2.accuracy.length > 0
      ? (this.metrics.v2.accuracy.reduce((a, b) => a + b, 0) / this.metrics.v2.accuracy.length).toFixed(2)
      : 0;

    const v1CacheHitRate = this.metrics.v1.attempts > 0
      ? (this.metrics.v1.cacheHits / this.metrics.v1.attempts * 100).toFixed(1)
      : 0;

    const v2CacheHitRate = this.metrics.v2.attempts > 0
      ? (this.metrics.v2.cacheHits / this.metrics.v2.attempts * 100).toFixed(1)
      : 0;

    return {
      summary: {
        v1: {
          attempts: this.metrics.v1.attempts,
          successRate: `${v1SuccessRate}%`,
          avgTime: `${this.metrics.v1.avgTime}ms`,
          avgAccuracy: v1AvgAccuracy,
          cacheHitRate: `${v1CacheHitRate}%`
        },
        v2: {
          attempts: this.metrics.v2.attempts,
          successRate: `${v2SuccessRate}%`,
          avgTime: `${this.metrics.v2.avgTime}ms`,
          avgAccuracy: v2AvgAccuracy,
          cacheHitRate: `${v2CacheHitRate}%`
        }
      },
      comparison: {
        speedImprovement: this.metrics.v1.avgTime > 0
          ? `${((1 - this.metrics.v2.avgTime / this.metrics.v1.avgTime) * 100).toFixed(1)}%`
          : 'N/A',
        accuracyImprovement: v1AvgAccuracy > 0
          ? `${((v2AvgAccuracy - v1AvgAccuracy) / v1AvgAccuracy * 100).toFixed(1)}%`
          : 'N/A',
        successRateImprovement: `${(v2SuccessRate - v1SuccessRate).toFixed(1)}%`,
        winner: v2SuccessRate > v1SuccessRate ? 'V2' : 'V1'
      },
      sites: this.metrics.sites,
      recentErrors: {
        v1: this.metrics.v1.errors.slice(-5),
        v2: this.metrics.v2.errors.slice(-5)
      },
      lastReset: this.metrics.lastReset
    };
  }

  /**
   * Get recommendations based on metrics
   */
  getRecommendations() {
    const metrics = this.getMetrics();
    const recommendations = [];

    // Check if V2 is performing better
    const v2SuccessRate = parseFloat(metrics.summary.v2.successRate);
    const v1SuccessRate = parseFloat(metrics.summary.v1.successRate);

    if (v2SuccessRate > v1SuccessRate + 10) {
      recommendations.push({
        type: 'success',
        message: `V2 is performing ${(v2SuccessRate - v1SuccessRate).toFixed(1)}% better than V1`,
        action: 'Consider increasing V2 rollout percentage'
      });
    } else if (v1SuccessRate > v2SuccessRate + 10) {
      recommendations.push({
        type: 'warning',
        message: `V1 is performing ${(v1SuccessRate - v2SuccessRate).toFixed(1)}% better than V2`,
        action: 'Review V2 configuration and error logs'
      });
    }

    // Check speed improvements
    if (this.metrics.v2.avgTime < this.metrics.v1.avgTime * 0.7) {
      recommendations.push({
        type: 'success',
        message: `V2 is ${metrics.comparison.speedImprovement} faster`,
        action: 'V2 performance optimization is working'
      });
    }

    // Check cache effectiveness
    const v2CacheRate = parseFloat(metrics.summary.v2.cacheHitRate);
    if (v2CacheRate > 30) {
      recommendations.push({
        type: 'success',
        message: `V2 cache hit rate is ${metrics.summary.v2.cacheHitRate}`,
        action: 'Caching is reducing API costs effectively'
      });
    } else if (v2CacheRate < 10 && this.metrics.v2.attempts > 10) {
      recommendations.push({
        type: 'info',
        message: 'Low cache hit rate detected',
        action: 'Consider increasing cache TTL or reviewing usage patterns'
      });
    }

    // Site-specific recommendations
    for (const [site, data] of Object.entries(this.metrics.sites)) {
      const v2SiteSuccess = data.v2.attempts > 0
        ? (data.v2.successes / data.v2.attempts * 100).toFixed(1)
        : 0;

      const v1SiteSuccess = data.v1.attempts > 0
        ? (data.v1.successes / data.v1.attempts * 100).toFixed(1)
        : 0;

      if (v2SiteSuccess < 50 && data.v2.attempts > 3) {
        recommendations.push({
          type: 'warning',
          message: `${site} has low V2 success rate (${v2SiteSuccess}%)`,
          action: `Review site-specific configuration for ${site}`
        });
      }
    }

    return recommendations;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      v1: {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
        accuracy: [],
        cacheHits: 0,
        errors: []
      },
      v2: {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
        accuracy: [],
        cacheHits: 0,
        errors: []
      },
      sites: {},
      lastReset: new Date().toISOString()
    };
  }
}

// Singleton instance
let instance = null;

function getFirecrawlMetrics() {
  if (!instance) {
    instance = new FirecrawlMetrics();
  }
  return instance;
}

module.exports = { getFirecrawlMetrics };