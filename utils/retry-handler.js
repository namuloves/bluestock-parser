class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // Start with 1 second
    this.maxDelay = options.maxDelay || 30000; // Max 30 seconds
    this.factor = options.factor || 2; // Exponential factor
    this.jitter = options.jitter !== false; // Add randomness to prevent thundering herd
  }

  async execute(fn, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Execute the function
        const result = await fn();

        // Success - return result
        if (attempt > 0) {
          console.log(`✅ Succeeded on retry ${attempt} for ${context.url || 'unknown'}`);
        }

        return result;

      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Don't retry after last attempt
        if (attempt === this.maxRetries) {
          console.error(`❌ Failed after ${this.maxRetries} retries: ${error.message}`);
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);

        console.log(`⚠️ Attempt ${attempt + 1} failed for ${context.url || 'unknown'}: ${error.message}`);
        console.log(`⏳ Retrying in ${delay}ms...`);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw lastError;
  }

  isRetryable(error) {
    // Network errors
    if (error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response) {
      const status = error.response.status;

      // Rate limiting - definitely retry
      if (status === 429) return true;

      // Server errors - retry
      if (status >= 500 && status < 600) return true;

      // Timeout
      if (status === 408) return true;

      // Temporary unavailable
      if (status === 503) return true;
    }

    // Timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    // Navigation timeout from Puppeteer
    if (error.message && error.message.includes('Navigation timeout')) {
      return true;
    }

    // Don't retry client errors (400-499 except 429)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false;
    }

    // Default to not retrying unknown errors
    return false;
  }

  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * (factor ^ attempt)
    let delay = this.baseDelay * Math.pow(this.factor, attempt);

    // Cap at maximum delay
    delay = Math.min(delay, this.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitterAmount = delay * 0.3; // 30% jitter
      const randomJitter = Math.random() * jitterAmount - jitterAmount / 2;
      delay = Math.max(0, delay + randomJitter);
    }

    return Math.round(delay);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get retry statistics
  getStats() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      factor: this.factor,
      jitter: this.jitter
    };
  }
}

// Domain-specific retry configurations
class DomainRetryHandler {
  constructor() {
    this.domainConfigs = {
      // Sites that need more aggressive retries
      'zara.com': {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000
      },
      'nordstrom.com': {
        maxRetries: 4,
        baseDelay: 3000,
        maxDelay: 45000
      },
      'farfetch.com': {
        maxRetries: 4,
        baseDelay: 2500,
        maxDelay: 40000
      },

      // Sites that are more stable
      'uniqlo.com': {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 10000
      },
      'ssense.com': {
        maxRetries: 3,
        baseDelay: 1500,
        maxDelay: 20000
      },

      // Default configuration
      default: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        factor: 2,
        jitter: true
      }
    };

    // Track retry statistics
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      byDomain: {}
    };
  }

  getHandlerForDomain(domain) {
    const config = this.domainConfigs[domain] || this.domainConfigs.default;
    return new RetryHandler(config);
  }

  async executeWithRetry(fn, url) {
    const domain = new URL(url).hostname.replace('www.', '');
    const handler = this.getHandlerForDomain(domain);

    // Initialize domain stats if needed
    if (!this.stats.byDomain[domain]) {
      this.stats.byDomain[domain] = {
        attempts: 0,
        successes: 0,
        failures: 0
      };
    }

    this.stats.byDomain[domain].attempts++;

    try {
      const result = await handler.execute(fn, { url });
      this.stats.byDomain[domain].successes++;
      this.stats.successfulRetries++;
      return result;
    } catch (error) {
      this.stats.byDomain[domain].failures++;
      this.stats.failedRetries++;
      throw error;
    }
  }

  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalRetries > 0
        ? ((this.stats.successfulRetries / this.stats.totalRetries) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

module.exports = { RetryHandler, DomainRetryHandler };