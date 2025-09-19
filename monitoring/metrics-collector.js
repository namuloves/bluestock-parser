const fs = require('fs').promises;
const path = require('path');

class MetricsCollector {
  constructor() {
    this.metricsDir = path.join(__dirname, 'data');
    this.currentMetrics = {
      date: new Date().toISOString().split('T')[0],
      totalRequests: 0,
      universalAttempts: 0,
      universalSuccess: 0,
      universalPartial: 0,
      fallbackUsed: 0,
      completeFailure: 0,
      avgConfidence: 0,
      avgResponseTime: 0,
      sitesData: {},
      fieldExtractionRates: {
        name: 0,
        price: 0,
        images: 0,
        brand: 0
      },
      strategySuccess: {
        jsonLd: 0,
        openGraph: 0,
        microdata: 0,
        patterns: 0,
        generic: 0
      },
      errorTypes: {}
    };

    this.sessionMetrics = [];
    this.initialize();
  }

  async initialize() {
    try {
      // Create metrics directory if it doesn't exist
      await fs.mkdir(this.metricsDir, { recursive: true });

      // Load today's metrics if they exist
      const todayFile = path.join(this.metricsDir, `${this.currentMetrics.date}.json`);
      try {
        const existing = await fs.readFile(todayFile, 'utf8');
        this.currentMetrics = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist, start fresh
      }
    } catch (error) {
      console.error('Failed to initialize metrics:', error);
    }
  }

  async recordRequest(url, universalResult, specificResult, timings) {
    const hostname = new URL(url).hostname.replace('www.', '');

    // Update totals
    this.currentMetrics.totalRequests++;

    // Initialize site data if needed
    if (!this.currentMetrics.sitesData[hostname]) {
      this.currentMetrics.sitesData[hostname] = {
        requests: 0,
        universalSuccess: 0,
        avgConfidence: 0,
        avgTime: 0,
        fieldSuccess: {
          name: 0,
          price: 0,
          images: 0,
          brand: 0
        }
      };
    }

    const siteData = this.currentMetrics.sitesData[hostname];
    siteData.requests++;

    // Record universal parser metrics
    if (universalResult) {
      this.currentMetrics.universalAttempts++;

      const confidence = universalResult.confidence || 0;
      const hasName = !!universalResult.product?.name;
      const hasPrice = !!universalResult.product?.price;
      const hasImages = universalResult.product?.images?.length > 0;
      const hasBrand = !!universalResult.product?.brand;

      // Update confidence average
      const prevAvg = this.currentMetrics.avgConfidence;
      const prevCount = this.currentMetrics.universalAttempts - 1;
      this.currentMetrics.avgConfidence = (prevAvg * prevCount + confidence) / this.currentMetrics.universalAttempts;

      // Update site confidence
      const sitePrevAvg = siteData.avgConfidence;
      const sitePrevCount = siteData.requests - 1;
      siteData.avgConfidence = (sitePrevAvg * sitePrevCount + confidence) / siteData.requests;

      // Categorize result
      if (confidence > 0.7 && hasName && hasPrice) {
        this.currentMetrics.universalSuccess++;
        siteData.universalSuccess++;
      } else if (confidence > 0.3 || hasName || hasPrice) {
        this.currentMetrics.universalPartial++;
      } else {
        this.currentMetrics.fallbackUsed++;
      }

      // Update field extraction rates
      if (hasName) {
        this.currentMetrics.fieldExtractionRates.name++;
        siteData.fieldSuccess.name++;
      }
      if (hasPrice) {
        this.currentMetrics.fieldExtractionRates.price++;
        siteData.fieldSuccess.price++;
      }
      if (hasImages) {
        this.currentMetrics.fieldExtractionRates.images++;
        siteData.fieldSuccess.images++;
      }
      if (hasBrand) {
        this.currentMetrics.fieldExtractionRates.brand++;
        siteData.fieldSuccess.brand++;
      }

      // Track strategy success
      if (universalResult.product) {
        ['name', 'price', 'brand', 'images'].forEach(field => {
          const source = universalResult.product[`${field}_source`];
          if (source && this.currentMetrics.strategySuccess[source] !== undefined) {
            this.currentMetrics.strategySuccess[source]++;
          }
        });
      }
    } else {
      this.currentMetrics.fallbackUsed++;
    }

    // Check for complete failure
    if (!specificResult?.success) {
      this.currentMetrics.completeFailure++;
    }

    // Record timing
    if (timings) {
      const totalTime = timings.endTime - timings.startTime;
      const prevAvgTime = this.currentMetrics.avgResponseTime;
      const prevCount = this.currentMetrics.totalRequests - 1;
      this.currentMetrics.avgResponseTime = (prevAvgTime * prevCount + totalTime) / this.currentMetrics.totalRequests;

      // Update site timing
      const sitePrevAvgTime = siteData.avgTime;
      const sitePrevCount = siteData.requests - 1;
      siteData.avgTime = (sitePrevAvgTime * sitePrevCount + totalTime) / siteData.requests;
    }

    // Record session metric for real-time monitoring
    this.sessionMetrics.push({
      timestamp: new Date().toISOString(),
      url: url,
      site: hostname,
      universalConfidence: universalResult?.confidence || 0,
      universalSuccess: !!(universalResult?.confidence > 0.7),
      specificSuccess: specificResult?.success || false,
      responseTime: timings ? timings.endTime - timings.startTime : null
    });

    // Keep only last 100 session metrics
    if (this.sessionMetrics.length > 100) {
      this.sessionMetrics.shift();
    }

    // Save metrics periodically
    await this.saveMetrics();
  }

  async saveMetrics() {
    try {
      const todayFile = path.join(this.metricsDir, `${this.currentMetrics.date}.json`);
      await fs.writeFile(todayFile, JSON.stringify(this.currentMetrics, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  getSessionSummary() {
    if (this.sessionMetrics.length === 0) {
      return { message: 'No metrics collected yet' };
    }

    const recentMetrics = this.sessionMetrics.slice(-20); // Last 20 requests
    const universalSuccessRate = recentMetrics.filter(m => m.universalSuccess).length / recentMetrics.length;
    const specificSuccessRate = recentMetrics.filter(m => m.specificSuccess).length / recentMetrics.length;
    const avgConfidence = recentMetrics.reduce((sum, m) => sum + m.universalConfidence, 0) / recentMetrics.length;
    const avgTime = recentMetrics
      .filter(m => m.responseTime !== null)
      .reduce((sum, m, _, arr) => sum + m.responseTime / arr.length, 0);

    return {
      totalRequests: this.currentMetrics.totalRequests,
      recentRequests: recentMetrics.length,
      universalSuccessRate: (universalSuccessRate * 100).toFixed(1) + '%',
      specificSuccessRate: (specificSuccessRate * 100).toFixed(1) + '%',
      avgConfidence: avgConfidence.toFixed(2),
      avgResponseTime: avgTime.toFixed(0) + 'ms',
      topSites: this.getTopSites(),
      fieldExtractionRates: this.getFieldRates()
    };
  }

  getTopSites() {
    const sites = Object.entries(this.currentMetrics.sitesData)
      .map(([hostname, data]) => ({
        hostname,
        requests: data.requests,
        successRate: data.universalSuccess / data.requests,
        avgConfidence: data.avgConfidence
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    return sites;
  }

  getFieldRates() {
    const attempts = this.currentMetrics.universalAttempts || 1;
    return {
      name: ((this.currentMetrics.fieldExtractionRates.name / attempts) * 100).toFixed(1) + '%',
      price: ((this.currentMetrics.fieldExtractionRates.price / attempts) * 100).toFixed(1) + '%',
      images: ((this.currentMetrics.fieldExtractionRates.images / attempts) * 100).toFixed(1) + '%',
      brand: ((this.currentMetrics.fieldExtractionRates.brand / attempts) * 100).toFixed(1) + '%'
    };
  }

  async generateReport() {
    const summary = this.getSessionSummary();
    const date = new Date().toISOString();

    const report = `
╔════════════════════════════════════════════════════════════╗
║           UNIVERSAL PARSER METRICS REPORT                  ║
║                   ${date}                                  ║
╚════════════════════════════════════════════════════════════╝

📊 OVERVIEW
─────────────────────────────────────────────────────────────
  Total Requests:        ${this.currentMetrics.totalRequests}
  Universal Attempts:    ${this.currentMetrics.universalAttempts}
  Universal Success:     ${this.currentMetrics.universalSuccess} (${((this.currentMetrics.universalSuccess / (this.currentMetrics.universalAttempts || 1)) * 100).toFixed(1)}%)
  Fallback Used:         ${this.currentMetrics.fallbackUsed}
  Complete Failures:     ${this.currentMetrics.completeFailure}

📈 PERFORMANCE
─────────────────────────────────────────────────────────────
  Avg Confidence:        ${this.currentMetrics.avgConfidence.toFixed(2)}
  Avg Response Time:     ${this.currentMetrics.avgResponseTime.toFixed(0)}ms
  Success Rate:          ${summary.universalSuccessRate}

🏷️ FIELD EXTRACTION RATES
─────────────────────────────────────────────────────────────
  Product Name:          ${summary.fieldExtractionRates.name}
  Price:                 ${summary.fieldExtractionRates.price}
  Images:                ${summary.fieldExtractionRates.images}
  Brand:                 ${summary.fieldExtractionRates.brand}

🎯 STRATEGY EFFECTIVENESS
─────────────────────────────────────────────────────────────
  JSON-LD:               ${this.currentMetrics.strategySuccess.jsonLd}
  OpenGraph:             ${this.currentMetrics.strategySuccess.openGraph}
  Microdata:             ${this.currentMetrics.strategySuccess.microdata}
  Patterns:              ${this.currentMetrics.strategySuccess.patterns}
  Generic:               ${this.currentMetrics.strategySuccess.generic}

🌐 TOP SITES
─────────────────────────────────────────────────────────────
${summary.topSites.map((site, i) =>
  `  ${i + 1}. ${site.hostname.padEnd(25)} ${site.requests} requests, ${(site.successRate * 100).toFixed(1)}% success`
).join('\n')}

${this.getRecommendations()}
`;

    // Save report
    const reportFile = path.join(this.metricsDir, `report-${this.currentMetrics.date}.txt`);
    await fs.writeFile(reportFile, report);

    return report;
  }

  getRecommendations() {
    const recommendations = [];
    const avgConfidence = this.currentMetrics.avgConfidence;
    const successRate = this.currentMetrics.universalSuccess / (this.currentMetrics.universalAttempts || 1);

    if (avgConfidence > 0.8 && successRate > 0.7) {
      recommendations.push('✅ Universal Parser performing well! Consider switching to FULL mode.');
    }

    if (avgConfidence > 0.6 && successRate > 0.5) {
      recommendations.push('📈 Good performance. Consider enabling PARTIAL mode for top sites.');
    }

    if (avgConfidence < 0.5) {
      recommendations.push('⚠️ Low confidence scores. Pattern database needs more training.');
    }

    // Site-specific recommendations
    const goodSites = Object.entries(this.currentMetrics.sitesData)
      .filter(([_, data]) => data.avgConfidence > 0.8 && data.requests > 5)
      .map(([hostname]) => hostname);

    if (goodSites.length > 0) {
      recommendations.push(`🎯 Enable for these sites: ${goodSites.join(', ')}`);
    }

    return recommendations.length > 0 ?
      '\n💡 RECOMMENDATIONS\n─────────────────────────────────────────────────────────────\n' +
      recommendations.map(r => '  ' + r).join('\n') : '';
  }
}

// Singleton instance
let metricsCollector = null;

function getMetricsCollector() {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

module.exports = { getMetricsCollector, MetricsCollector };