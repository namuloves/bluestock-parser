/**
 * Gradual Rollout Configuration
 * Controls which domains use the lean parser vs legacy parsers
 */

class RolloutConfig {
  constructor() {
    // Phase 2: Trusted domains that should use lean parser
    this.trustedDomains = new Set([
      'zara.com',
      'hm.com',
      'www2.hm.com',
      'nordstrom.com',
      'shop.nordstrom.com',
      'asos.com',
      'cos.com',
      'uniqlo.com'
    ]);

    // Phase 3: Percentage of non-trusted domains to try lean parser
    this.leanParserPercentage = parseInt(process.env.LEAN_PARSER_PERCENTAGE || '0');

    // Monitoring metrics
    this.metrics = {
      totalRequests: 0,
      leanParserUsed: 0,
      leanParserSuccess: 0,
      leanParserFailures: 0,
      legacyParserUsed: 0,
      legacyParserSuccess: 0,
      legacyParserFailures: 0,
      fallbacksUsed: 0,
      byDomain: {}
    };

    // Rollout mode: 'disabled', 'trusted_only', 'percentage', 'primary_with_fallback', 'full'
    this.mode = process.env.LEAN_ROLLOUT_MODE || 'primary_with_fallback';
  }

  /**
   * Determine which parser to use for a given URL
   * @param {string} url - The URL to parse
   * @returns {object} - { useLeanParser: boolean, reason: string }
   */
  getParserDecision(url) {
    this.metrics.totalRequests++;

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const domain = hostname.replace('www.', '');

      // Initialize domain metrics if needed
      if (!this.metrics.byDomain[domain]) {
        this.metrics.byDomain[domain] = {
          total: 0,
          leanSuccess: 0,
          leanFailure: 0,
          legacySuccess: 0,
          legacyFailure: 0
        };
      }

      this.metrics.byDomain[domain].total++;

      // Check rollout mode
      switch(this.mode) {
        case 'disabled':
          return { useLeanParser: false, reason: 'Rollout disabled' };

        case 'trusted_only':
          if (this.trustedDomains.has(domain) || this.trustedDomains.has(hostname)) {
            return { useLeanParser: true, reason: 'Trusted domain' };
          }
          return { useLeanParser: false, reason: 'Not a trusted domain' };

        case 'percentage':
          // Use lean parser for trusted domains
          if (this.trustedDomains.has(domain) || this.trustedDomains.has(hostname)) {
            return { useLeanParser: true, reason: 'Trusted domain' };
          }
          // Random percentage for other domains
          const random = Math.random() * 100;
          if (random < this.leanParserPercentage) {
            return { useLeanParser: true, reason: `Random selection (${this.leanParserPercentage}%)` };
          }
          return { useLeanParser: false, reason: 'Not selected in percentage rollout' };

        case 'primary_with_fallback':
          // Always try lean parser first, with fallback to legacy
          return { useLeanParser: true, reason: 'Primary parser (with fallback)' };

        case 'full':
          // Always use lean parser
          return { useLeanParser: true, reason: 'Full rollout - lean parser only' };

        default:
          return { useLeanParser: false, reason: 'Unknown rollout mode' };
      }
    } catch (error) {
      console.error('Error in parser decision:', error);
      return { useLeanParser: false, reason: 'Error in decision logic' };
    }
  }

  /**
   * Record parser result for metrics
   */
  recordResult(url, parserType, success, fallbackUsed = false) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const domain = hostname.replace('www.', '');

      if (!this.metrics.byDomain[domain]) {
        this.metrics.byDomain[domain] = {
          total: 0,
          leanSuccess: 0,
          leanFailure: 0,
          legacySuccess: 0,
          legacyFailure: 0
        };
      }

      if (parserType === 'lean') {
        this.metrics.leanParserUsed++;
        if (success) {
          this.metrics.leanParserSuccess++;
          this.metrics.byDomain[domain].leanSuccess++;
        } else {
          this.metrics.leanParserFailures++;
          this.metrics.byDomain[domain].leanFailure++;
        }
      } else if (parserType === 'legacy') {
        this.metrics.legacyParserUsed++;
        if (success) {
          this.metrics.legacyParserSuccess++;
          this.metrics.byDomain[domain].legacySuccess++;
        } else {
          this.metrics.legacyParserFailures++;
          this.metrics.byDomain[domain].legacyFailure++;
        }
      }

      if (fallbackUsed) {
        this.metrics.fallbacksUsed++;
      }
    } catch (error) {
      console.error('Error recording metrics:', error);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const leanTotal = this.metrics.leanParserUsed || 1;
    const legacyTotal = this.metrics.legacyParserUsed || 1;

    return {
      mode: this.mode,
      summary: {
        totalRequests: this.metrics.totalRequests,
        leanParserUsage: `${((this.metrics.leanParserUsed / Math.max(this.metrics.totalRequests, 1)) * 100).toFixed(1)}%`,
        leanSuccessRate: `${((this.metrics.leanParserSuccess / leanTotal) * 100).toFixed(1)}%`,
        legacySuccessRate: `${((this.metrics.legacyParserSuccess / legacyTotal) * 100).toFixed(1)}%`,
        fallbacksUsed: this.metrics.fallbacksUsed
      },
      detailed: this.metrics,
      trustedDomains: Array.from(this.trustedDomains),
      recommendations: this.getRecommendations()
    };
  }

  /**
   * Get recommendations based on metrics
   */
  getRecommendations() {
    const recommendations = [];
    const leanSuccessRate = (this.metrics.leanParserSuccess / Math.max(this.metrics.leanParserUsed, 1)) * 100;
    const legacySuccessRate = (this.metrics.legacyParserSuccess / Math.max(this.metrics.legacyParserUsed, 1)) * 100;

    // Mode progression recommendations
    if (this.mode === 'trusted_only' && leanSuccessRate > 95 && this.metrics.leanParserUsed > 50) {
      recommendations.push({
        action: 'ADVANCE_TO_PERCENTAGE',
        reason: `Lean parser showing ${leanSuccessRate.toFixed(1)}% success on trusted domains`,
        command: "Set LEAN_ROLLOUT_MODE=percentage and LEAN_PARSER_PERCENTAGE=10"
      });
    }

    if (this.mode === 'percentage' && leanSuccessRate > 90 && this.metrics.leanParserUsed > 200) {
      if (this.leanParserPercentage < 50) {
        recommendations.push({
          action: 'INCREASE_PERCENTAGE',
          reason: `Lean parser stable at ${leanSuccessRate.toFixed(1)}% success`,
          command: `Increase LEAN_PARSER_PERCENTAGE from ${this.leanParserPercentage}% to ${Math.min(this.leanParserPercentage + 20, 50)}%`
        });
      } else {
        recommendations.push({
          action: 'ADVANCE_TO_PRIMARY',
          reason: `Lean parser proven stable at ${leanSuccessRate.toFixed(1)}% success with ${this.leanParserPercentage}% traffic`,
          command: "Set LEAN_ROLLOUT_MODE=primary_with_fallback"
        });
      }
    }

    if (this.mode === 'primary_with_fallback' && this.metrics.fallbacksUsed < 5 && this.metrics.totalRequests > 500) {
      recommendations.push({
        action: 'ADVANCE_TO_FULL',
        reason: `Only ${this.metrics.fallbacksUsed} fallbacks needed in ${this.metrics.totalRequests} requests`,
        command: "Set LEAN_ROLLOUT_MODE=full"
      });
    }

    // Domain-specific recommendations
    for (const [domain, stats] of Object.entries(this.metrics.byDomain)) {
      if (stats.leanFailure > stats.leanSuccess && stats.total > 10) {
        recommendations.push({
          action: 'ADD_RECIPE',
          reason: `${domain} has poor lean parser performance (${stats.leanSuccess}/${stats.leanFailure + stats.leanSuccess} success)`,
          command: `Create /recipes/${domain}.yml with proper selectors`
        });
      }
    }

    return recommendations;
  }

  /**
   * Add a domain to trusted list
   */
  addTrustedDomain(domain) {
    this.trustedDomains.add(domain.toLowerCase());
    console.log(`✅ Added ${domain} to trusted domains`);
  }

  /**
   * Remove a domain from trusted list
   */
  removeTrustedDomain(domain) {
    this.trustedDomains.delete(domain.toLowerCase());
    console.log(`❌ Removed ${domain} from trusted domains`);
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      leanParserUsed: 0,
      leanParserSuccess: 0,
      leanParserFailures: 0,
      legacyParserUsed: 0,
      legacyParserSuccess: 0,
      legacyParserFailures: 0,
      fallbacksUsed: 0,
      byDomain: {}
    };
    console.log('📊 Rollout metrics reset');
  }
}

// Singleton instance
let rolloutConfig = null;

function getRolloutConfig() {
  if (!rolloutConfig) {
    rolloutConfig = new RolloutConfig();
  }
  return rolloutConfig;
}

module.exports = {
  getRolloutConfig
};