const { getMetricsCollector } = require('./metrics-collector');
const { getUniversalConfig } = require('../config/universal-config');
const fs = require('fs').promises;
const path = require('path');

class AutoPromoter {
  constructor() {
    this.config = getUniversalConfig();
    this.metricsCollector = getMetricsCollector();
    this.promotionHistory = [];
    this.isRunning = false;
    this.interval = null;

    this.thresholds = {
      // Minimum requirements for promotion
      minRequests: parseInt(process.env.AUTO_PROMOTE_MIN_REQUESTS || '10'),
      minConfidence: parseFloat(process.env.AUTO_PROMOTE_MIN_CONFIDENCE || '0.75'),
      minSuccessRate: parseFloat(process.env.AUTO_PROMOTE_MIN_SUCCESS || '0.7'),

      // Requirements for full mode
      fullModeRequests: parseInt(process.env.FULL_MODE_MIN_REQUESTS || '100'),
      fullModeConfidence: parseFloat(process.env.FULL_MODE_MIN_CONFIDENCE || '0.8'),
      fullModeSuccessRate: parseFloat(process.env.FULL_MODE_MIN_SUCCESS || '0.75'),

      // Demotion thresholds (if performance drops)
      demoteConfidence: 0.5,
      demoteSuccessRate: 0.4
    };

    this.loadHistory();
  }

  async loadHistory() {
    try {
      const historyFile = path.join(__dirname, 'promotion-history.json');
      const data = await fs.readFile(historyFile, 'utf8');
      this.promotionHistory = JSON.parse(data);
    } catch (e) {
      // No history yet
      this.promotionHistory = [];
    }
  }

  async saveHistory() {
    try {
      const historyFile = path.join(__dirname, 'promotion-history.json');
      await fs.writeFile(historyFile, JSON.stringify(this.promotionHistory, null, 2));
    } catch (e) {
      console.error('Failed to save promotion history:', e);
    }
  }

  async start(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('⚠️ Auto-promoter already running');
      return;
    }

    this.isRunning = true;
    console.log(`🤖 Auto-promoter started (checking every ${intervalMinutes} minutes)`);

    // Run immediately
    await this.checkAndPromote();

    // Then run periodically
    this.interval = setInterval(async () => {
      await this.checkAndPromote();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Auto-promoter stopped');
  }

  async checkAndPromote() {
    console.log('\n📊 Running auto-promotion check...');
    const timestamp = new Date().toISOString();

    try {
      // Load today's metrics
      const metricsFile = path.join(__dirname, 'data', `${new Date().toISOString().split('T')[0]}.json`);
      let metrics;

      try {
        const data = await fs.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(data);
      } catch (e) {
        console.log('No metrics data available yet');
        return;
      }

      const promotions = [];
      const demotions = [];
      const recommendations = [];

      // Check each site's performance
      for (const [hostname, siteData] of Object.entries(metrics.sitesData || {})) {
        const analysis = this.analyzeSite(hostname, siteData);

        if (analysis.action === 'promote') {
          await this.promoteSite(hostname, analysis.reason);
          promotions.push({ hostname, ...analysis });
        } else if (analysis.action === 'demote') {
          await this.demoteSite(hostname, analysis.reason);
          demotions.push({ hostname, ...analysis });
        } else if (analysis.action === 'watch') {
          recommendations.push({ hostname, ...analysis });
        }
      }

      // Check overall readiness for mode changes
      const modeRecommendation = this.checkModeReadiness(metrics);

      // Record history
      const event = {
        timestamp,
        promotions: promotions.length,
        demotions: demotions.length,
        currentMode: this.config.getMode(),
        metrics: {
          totalRequests: metrics.totalRequests,
          avgConfidence: metrics.avgConfidence,
          successRate: metrics.universalSuccess / (metrics.universalAttempts || 1)
        },
        details: { promotions, demotions }
      };

      this.promotionHistory.push(event);
      await this.saveHistory();

      // Generate report
      this.generateReport(promotions, demotions, recommendations, modeRecommendation, metrics);

      // Apply mode recommendation if auto-mode is enabled
      if (process.env.AUTO_MODE_CHANGE === 'true' && modeRecommendation.shouldChange) {
        await this.config.setMode(modeRecommendation.newMode);
        console.log(`🚀 Automatically changed mode to: ${modeRecommendation.newMode}`);
      }

    } catch (error) {
      console.error('❌ Auto-promotion error:', error);
    }
  }

  analyzeSite(hostname, data) {
    const confidence = data.avgConfidence || 0;
    const requests = data.requests || 0;
    const successRate = data.universalSuccess / (requests || 1);

    const currentlyEnabled = this.config.getEnabledSites().includes(hostname);

    // Check for promotion
    if (!currentlyEnabled &&
        requests >= this.thresholds.minRequests &&
        confidence >= this.thresholds.minConfidence &&
        successRate >= this.thresholds.minSuccessRate) {

      return {
        action: 'promote',
        reason: `Meets thresholds: ${(confidence * 100).toFixed(0)}% confidence, ${(successRate * 100).toFixed(0)}% success rate`,
        confidence,
        successRate,
        requests
      };
    }

    // Check for demotion
    if (currentlyEnabled &&
        requests >= 10 && // Need enough data to demote
        (confidence < this.thresholds.demoteConfidence ||
         successRate < this.thresholds.demoteSuccessRate)) {

      return {
        action: 'demote',
        reason: `Below thresholds: ${(confidence * 100).toFixed(0)}% confidence, ${(successRate * 100).toFixed(0)}% success rate`,
        confidence,
        successRate,
        requests
      };
    }

    // Check if close to promotion
    if (!currentlyEnabled && requests >= 5) {
      const confidenceGap = this.thresholds.minConfidence - confidence;
      const requestsNeeded = this.thresholds.minRequests - requests;

      if (confidenceGap < 0.1 || requestsNeeded <= 3) {
        return {
          action: 'watch',
          reason: `Close to promotion: needs ${Math.max(0, requestsNeeded)} more requests or ${(confidenceGap * 100).toFixed(0)}% more confidence`,
          confidence,
          successRate,
          requests
        };
      }
    }

    return {
      action: 'none',
      confidence,
      successRate,
      requests
    };
  }

  checkModeReadiness(metrics) {
    const currentMode = this.config.getMode();
    const totalRequests = metrics.totalRequests || 0;
    const avgConfidence = metrics.avgConfidence || 0;
    const successRate = metrics.universalSuccess / (metrics.universalAttempts || 1);
    const enabledSites = this.config.getEnabledSites().length;

    // Check if ready for partial mode
    if (currentMode === 'shadow' && enabledSites >= 3) {
      return {
        shouldChange: false,
        newMode: 'partial',
        reason: `${enabledSites} sites ready for Universal Parser`,
        recommendation: 'Consider switching to PARTIAL mode'
      };
    }

    // Check if ready for full mode
    if ((currentMode === 'shadow' || currentMode === 'partial') &&
        totalRequests >= this.thresholds.fullModeRequests &&
        avgConfidence >= this.thresholds.fullModeConfidence &&
        successRate >= this.thresholds.fullModeSuccessRate) {

      return {
        shouldChange: false,
        newMode: 'full',
        reason: `Excellent performance: ${(avgConfidence * 100).toFixed(0)}% confidence, ${(successRate * 100).toFixed(0)}% success`,
        recommendation: 'Ready for FULL mode!'
      };
    }

    // Check if should downgrade
    if (currentMode === 'full' &&
        (avgConfidence < 0.6 || successRate < 0.5) &&
        totalRequests >= 50) {

      return {
        shouldChange: true,
        newMode: 'partial',
        reason: `Performance dropped: ${(avgConfidence * 100).toFixed(0)}% confidence, ${(successRate * 100).toFixed(0)}% success`,
        recommendation: 'Consider reverting to PARTIAL mode'
      };
    }

    return {
      shouldChange: false,
      currentMode,
      reason: 'Current mode appropriate',
      recommendation: null
    };
  }

  async promoteSite(hostname, reason) {
    await this.config.addEnabledSite(hostname);
    console.log(`✅ Promoted: ${hostname} - ${reason}`);
  }

  async demoteSite(hostname, reason) {
    await this.config.removeEnabledSite(hostname);
    await this.config.addDisabledSite(hostname);
    console.log(`⚠️ Demoted: ${hostname} - ${reason}`);
  }

  generateReport(promotions, demotions, recommendations, modeRec, metrics) {
    console.log('\n' + '═'.repeat(60));
    console.log('📈 AUTO-PROMOTION REPORT');
    console.log('═'.repeat(60));

    if (promotions.length > 0) {
      console.log('\n✅ PROMOTED SITES:');
      promotions.forEach(p => {
        console.log(`   ${p.hostname}: ${(p.confidence * 100).toFixed(0)}% confidence`);
      });
    }

    if (demotions.length > 0) {
      console.log('\n⚠️ DEMOTED SITES:');
      demotions.forEach(d => {
        console.log(`   ${d.hostname}: ${d.reason}`);
      });
    }

    if (recommendations.length > 0) {
      console.log('\n👀 WATCHING (close to promotion):');
      recommendations.forEach(r => {
        console.log(`   ${r.hostname}: ${r.reason}`);
      });
    }

    console.log('\n📊 OVERALL METRICS:');
    console.log(`   Mode: ${this.config.getMode().toUpperCase()}`);
    console.log(`   Enabled Sites: ${this.config.getEnabledSites().length}`);
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Average Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Success Rate: ${((metrics.universalSuccess / (metrics.universalAttempts || 1)) * 100).toFixed(1)}%`);

    if (modeRec.recommendation) {
      console.log(`\n💡 MODE RECOMMENDATION: ${modeRec.recommendation}`);
      console.log(`   Reason: ${modeRec.reason}`);
    }

    console.log('\n' + '═'.repeat(60));
  }

  async getPromotionStats() {
    // Get statistics about promotion history
    const last24h = this.promotionHistory.filter(e => {
      const age = Date.now() - new Date(e.timestamp).getTime();
      return age < 24 * 60 * 60 * 1000;
    });

    const last7d = this.promotionHistory.filter(e => {
      const age = Date.now() - new Date(e.timestamp).getTime();
      return age < 7 * 24 * 60 * 60 * 1000;
    });

    return {
      total: this.promotionHistory.length,
      last24h: {
        checks: last24h.length,
        promotions: last24h.reduce((sum, e) => sum + e.promotions, 0),
        demotions: last24h.reduce((sum, e) => sum + e.demotions, 0)
      },
      last7d: {
        checks: last7d.length,
        promotions: last7d.reduce((sum, e) => sum + e.promotions, 0),
        demotions: last7d.reduce((sum, e) => sum + e.demotions, 0)
      },
      currentlyEnabled: this.config.getEnabledSites()
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const promoter = new AutoPromoter();

  switch (command) {
    case 'start':
      const interval = parseInt(args[1]) || 30;
      await promoter.start(interval);
      console.log('Press Ctrl+C to stop');
      // Keep process alive
      process.on('SIGINT', () => {
        promoter.stop();
        process.exit(0);
      });
      break;

    case 'check':
      await promoter.checkAndPromote();
      break;

    case 'stats':
      const stats = await promoter.getPromotionStats();
      console.log('\n📊 Promotion Statistics:');
      console.log('─'.repeat(40));
      console.log(`Total Checks: ${stats.total}`);
      console.log(`\nLast 24 Hours:`);
      console.log(`  Checks: ${stats.last24h.checks}`);
      console.log(`  Promotions: ${stats.last24h.promotions}`);
      console.log(`  Demotions: ${stats.last24h.demotions}`);
      console.log(`\nLast 7 Days:`);
      console.log(`  Checks: ${stats.last7d.checks}`);
      console.log(`  Promotions: ${stats.last7d.promotions}`);
      console.log(`  Demotions: ${stats.last7d.demotions}`);
      console.log(`\nCurrently Enabled Sites: ${stats.currentlyEnabled.length}`);
      if (stats.currentlyEnabled.length > 0) {
        stats.currentlyEnabled.forEach(site => console.log(`  - ${site}`));
      }
      break;

    case 'help':
    default:
      console.log(`
Auto-Promoter - Automatically promote/demote sites based on performance

Usage: node monitoring/auto-promoter.js [command] [options]

Commands:
  start [interval]  Start auto-promoter (default: 30 minutes)
  check            Run one promotion check now
  stats            Show promotion statistics
  help             Show this help message

Environment Variables:
  AUTO_PROMOTE_MIN_REQUESTS    Minimum requests for promotion (default: 10)
  AUTO_PROMOTE_MIN_CONFIDENCE  Minimum confidence for promotion (default: 0.75)
  AUTO_PROMOTE_MIN_SUCCESS      Minimum success rate for promotion (default: 0.7)
  AUTO_MODE_CHANGE              Enable automatic mode changes (default: false)

Examples:
  node monitoring/auto-promoter.js start 15    # Check every 15 minutes
  node monitoring/auto-promoter.js check        # Run once now
  node monitoring/auto-promoter.js stats        # View statistics
`);
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AutoPromoter };