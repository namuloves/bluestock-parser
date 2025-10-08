/**
 * Smart Rendering Policy
 * Determines when browser rendering is actually needed
 * Saves money by avoiding unnecessary Puppeteer usage
 */

class RenderPolicy {
  constructor() {
    // SPA framework indicators
    this.spaIndicators = [
      'react-root',
      '__NEXT_DATA__',
      '__NUXT__',
      'vue-app',
      'angular-app',
      'ember-application',
      'svelte-app',
      'ng-version',
      '_app',
      'data-reactroot',
      'data-react-helmet'
    ];

    // Product page URL patterns
    this.productUrlPatterns = [
      /\/product\//i,
      /\/p\//i,
      /\/item\//i,
      /\/pd\//i,
      /\/pdp\//i,
      /\/products?\//i,
      /\/detail\//i,
      /\/goods\//i,
      /\/commodity\//i,
      /[-_]p\d+\.html/i  // product-p12345.html
    ];

    // Sites that definitely need rendering (from experience)
    this.alwaysRender = new Set([
      'farfetch.com',
      'ssense.com',
      'net-a-porter.com',
      'mytheresa.com',
      'matchesfashion.com',
      'fredhome.com.au'  // Nuxt.js SSR app with dynamic product data
    ]);

    // Sites that never need rendering (have good static HTML)
    this.neverRender = new Set([
      'zara.com',
      'hm.com',
      'uniqlo.com',
      'asos.com',
      'nordstrom.com'
    ]);

    // Track rendering decisions for learning
    this.renderDecisions = new Map();
    this.renderBudget = {
      hourly: 100,
      used: 0,
      resetTime: Date.now() + 3600000
    };
  }

  /**
   * Main decision function: should we render this page?
   */
  async shouldRender(url, initialHtml = null, $ = null) {
    const decision = {
      shouldRender: false,
      reason: null,
      confidence: 'high',
      factors: {}
    };

    try {
      const domain = this.getDomain(url);

      // Check render budget
      if (!this.checkBudget()) {
        decision.reason = 'Render budget exhausted';
        return decision;
      }

      // Check always/never lists
      if (this.alwaysRender.has(domain)) {
        decision.shouldRender = true;
        decision.reason = 'Domain requires rendering';
        decision.factors.alwaysList = true;
        return this.recordDecision(url, decision);
      }

      if (this.neverRender.has(domain)) {
        decision.shouldRender = false;
        decision.reason = 'Domain has good static HTML';
        decision.factors.neverList = true;
        return this.recordDecision(url, decision);
      }

      // Analyze the page
      const analysis = await this.analyzePage(url, initialHtml, $);
      decision.factors = analysis;

      // Decision logic
      if (!analysis.isProductPage) {
        decision.reason = 'Not a product page';
        return this.recordDecision(url, decision);
      }

      if (analysis.hasCompleteData) {
        decision.reason = 'Already has complete product data';
        return this.recordDecision(url, decision);
      }

      if (analysis.isSPA && !analysis.hasStructuredData) {
        decision.shouldRender = true;
        decision.reason = 'SPA without structured data';
        decision.confidence = analysis.spaConfidence;
        return this.recordDecision(url, decision);
      }

      if (analysis.hasLazyLoading && !analysis.hasAllImages) {
        decision.shouldRender = true;
        decision.reason = 'Lazy-loaded content detected';
        return this.recordDecision(url, decision);
      }

      // Default: don't render
      decision.reason = 'Static extraction should suffice';
      return this.recordDecision(url, decision);

    } catch (error) {
      console.error('❌ Render policy error:', error.message);
      decision.reason = 'Policy check failed, defaulting to no render';
      return decision;
    }
  }

  /**
   * Analyze page characteristics
   */
  async analyzePage(url, html, $) {
    const analysis = {
      isProductPage: false,
      isSPA: false,
      spaConfidence: 'low',
      hasStructuredData: false,
      hasCompleteData: false,
      hasLazyLoading: false,
      hasAllImages: false,
      dataCompleteness: 0
    };

    // Check if it's a product page
    analysis.isProductPage = this.isProductPage(url, html, $);

    // Check for SPA indicators
    const spaCheck = this.detectSPA(html, $);
    analysis.isSPA = spaCheck.isSPA;
    analysis.spaConfidence = spaCheck.confidence;

    // Check for structured data
    if ($) {
      analysis.hasStructuredData = this.hasStructuredData($);
      analysis.hasCompleteData = this.hasCompleteProductData($);
      analysis.hasLazyLoading = this.detectLazyLoading($);
      analysis.hasAllImages = this.checkImageCompleteness($);
      analysis.dataCompleteness = this.calculateDataCompleteness($);
    }

    return analysis;
  }

  /**
   * Check if URL/HTML indicates a product page
   */
  isProductPage(url, html, $) {
    // URL pattern match
    const urlMatch = this.productUrlPatterns.some(pattern => pattern.test(url));
    if (urlMatch) return true;

    // HTML content check
    if (html) {
      const htmlChecks = [
        html.includes('product-detail'),
        html.includes('product-info'),
        html.includes('pdp-container'),
        html.includes('itemtype="http://schema.org/Product"'),
        html.includes('"@type":"Product"')
      ];
      if (htmlChecks.some(check => check)) return true;
    }

    // jQuery-based checks
    if ($) {
      const domChecks = [
        $('[itemtype*="Product"]').length > 0,
        $('[data-product-id]').length > 0,
        $('.product-detail, .product-info, .pdp').length > 0,
        $('script[type="application/ld+json"]:contains("Product")').length > 0
      ];
      if (domChecks.some(check => check)) return true;
    }

    return false;
  }

  /**
   * Detect if page is an SPA
   */
  detectSPA(html, $) {
    let indicators = 0;
    let totalChecks = this.spaIndicators.length;

    if (html) {
      indicators = this.spaIndicators.filter(indicator =>
        html.includes(indicator)
      ).length;
    }

    // Additional SPA checks
    if ($) {
      if ($('[data-reactroot]').length > 0) indicators++;
      if ($('#__next').length > 0) indicators++;
      if ($('.vue-app').length > 0) indicators++;
      totalChecks += 3;
    }

    const confidence = indicators > 2 ? 'high' :
                      indicators > 0 ? 'medium' : 'low';

    return {
      isSPA: indicators > 0,
      confidence,
      indicatorCount: indicators
    };
  }

  /**
   * Check for structured data
   */
  hasStructuredData($) {
    const checks = [
      $('script[type="application/ld+json"]').length > 0,
      $('[itemtype*="schema.org/Product"]').length > 0,
      $('meta[property="og:type"][content="product"]').length > 0
    ];

    return checks.some(check => check);
  }

  /**
   * Check if we already have complete product data
   */
  hasCompleteProductData($) {
    const hasName = $('h1').text().trim().length > 0 ||
                   $('[itemprop="name"]').length > 0;

    const hasPrice = $('.price, .product-price, [itemprop="price"]').length > 0 ||
                    $('[data-price]').length > 0;

    const hasImages = $('img[src*="product"], img[src*="image"]').length > 0 ||
                     $('.product-image img, .gallery img').length > 0;

    // Check JSON-LD
    let hasJsonLd = false;
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json['@type'] === 'Product' && json.name && json.offers?.price) {
          hasJsonLd = true;
        }
      } catch (e) {}
    });

    return hasJsonLd || (hasName && hasPrice && hasImages);
  }

  /**
   * Detect lazy loading indicators
   */
  detectLazyLoading($) {
    const lazyIndicators = [
      $('[data-lazy], [data-src], [loading="lazy"]').length > 0,
      $('img[src*="placeholder"], img[src*="blur"]').length > 0,
      $('noscript').text().includes('<img')
    ];

    return lazyIndicators.some(indicator => indicator);
  }

  /**
   * Check if images are loaded
   */
  checkImageCompleteness($) {
    const images = $('.product-image img, .gallery img, [data-role="product-image"] img');
    if (images.length === 0) return false;

    let completeImages = 0;
    images.each((i, img) => {
      const src = $(img).attr('src') || '';
      if (src && !src.includes('placeholder') && !src.includes('blur')) {
        completeImages++;
      }
    });

    return completeImages >= Math.min(3, images.length);
  }

  /**
   * Calculate data completeness percentage
   */
  calculateDataCompleteness($) {
    let score = 0;
    const checks = [
      { weight: 30, test: () => $('h1').text().trim().length > 3 },
      { weight: 30, test: () => $('.price, [data-price]').length > 0 },
      { weight: 20, test: () => $('.product-image img').length > 0 },
      { weight: 10, test: () => $('.brand, [itemprop="brand"]').length > 0 },
      { weight: 10, test: () => $('.description, [itemprop="description"]').length > 0 }
    ];

    checks.forEach(check => {
      if (check.test()) {
        score += check.weight;
      }
    });

    return score;
  }

  /**
   * Check and update render budget
   */
  checkBudget() {
    // Reset budget if hour has passed
    if (Date.now() > this.renderBudget.resetTime) {
      this.renderBudget.used = 0;
      this.renderBudget.resetTime = Date.now() + 3600000;
    }

    return this.renderBudget.used < this.renderBudget.hourly;
  }

  /**
   * Record rendering decision for analysis
   */
  recordDecision(url, decision) {
    if (decision.shouldRender) {
      this.renderBudget.used++;
    }

    this.renderDecisions.set(url, {
      ...decision,
      timestamp: Date.now()
    });

    // Keep only last 100 decisions
    if (this.renderDecisions.size > 100) {
      const firstKey = this.renderDecisions.keys().next().value;
      this.renderDecisions.delete(firstKey);
    }

    console.log(`🎯 Render decision for ${this.getDomain(url)}: ${decision.shouldRender ? '✅ RENDER' : '⏭️ SKIP'} - ${decision.reason}`);

    return decision;
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
   * Get rendering statistics
   */
  getStats() {
    const decisions = Array.from(this.renderDecisions.values());
    const rendered = decisions.filter(d => d.shouldRender).length;

    return {
      totalDecisions: decisions.length,
      rendered,
      skipped: decisions.length - rendered,
      renderRate: decisions.length > 0 ? (rendered / decisions.length * 100).toFixed(1) + '%' : '0%',
      budget: {
        used: this.renderBudget.used,
        limit: this.renderBudget.hourly,
        resets: new Date(this.renderBudget.resetTime).toISOString()
      },
      topReasons: this.getTopReasons()
    };
  }

  /**
   * Get top reasons for render decisions
   */
  getTopReasons() {
    const reasons = {};
    this.renderDecisions.forEach(decision => {
      reasons[decision.reason] = (reasons[decision.reason] || 0) + 1;
    });

    return Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));
  }

  /**
   * Update always/never render lists based on success
   */
  updatePolicy(domain, wasSuccessful, neededRender) {
    // This could be used to learn over time
    // For now, just log for analysis
    console.log(`📊 Policy feedback: ${domain} - Success: ${wasSuccessful}, Rendered: ${neededRender}`);
  }
}

// Singleton instance
let renderPolicy = null;

module.exports = {
  getRenderPolicy: () => {
    if (!renderPolicy) {
      renderPolicy = new RenderPolicy();
    }
    return renderPolicy;
  },
  RenderPolicy
};