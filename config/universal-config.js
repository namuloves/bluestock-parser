const fs = require('fs').promises;
const path = require('path');

class UniversalParserConfig {
  constructor() {
    this.configFile = path.join(__dirname, 'universal-settings.json');
    this.config = {
      mode: 'shadow',
      confidence_threshold: 0.7,
      enabled_sites: [],
      disabled_sites: [],
      auto_promote_threshold: 0.8,
      auto_promote_min_requests: 10,
      performance_targets: {
        min_confidence: 0.7,
        max_response_time: 3000,
        min_success_rate: 0.7
      },
      rollout_schedule: [],
      last_updated: new Date().toISOString()
    };

    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (e) {
      // Config doesn't exist yet, save default
      await this.saveConfig();
    }
  }

  async saveConfig() {
    try {
      await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  getMode() {
    // Environment variable takes precedence
    return process.env.UNIVERSAL_MODE || this.config.mode;
  }

  async setMode(mode) {
    if (!['off', 'shadow', 'partial', 'full'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Must be off, shadow, partial, or full`);
    }
    this.config.mode = mode;
    this.config.last_updated = new Date().toISOString();
    await this.saveConfig();
    return true;
  }

  getEnabledSites() {
    // Environment variable takes precedence
    if (process.env.UNIVERSAL_SITES) {
      return process.env.UNIVERSAL_SITES.split(',').map(s => s.trim());
    }
    return this.config.enabled_sites;
  }

  async addEnabledSite(hostname) {
    if (!this.config.enabled_sites.includes(hostname)) {
      this.config.enabled_sites.push(hostname);
      await this.saveConfig();
    }
    return true;
  }

  async removeEnabledSite(hostname) {
    this.config.enabled_sites = this.config.enabled_sites.filter(s => s !== hostname);
    await this.saveConfig();
    return true;
  }

  async addDisabledSite(hostname) {
    if (!this.config.disabled_sites.includes(hostname)) {
      this.config.disabled_sites.push(hostname);
      await this.saveConfig();
    }
    return true;
  }

  isEnabled(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    const mode = this.getMode();

    // Check disabled list first
    if (this.config.disabled_sites.some(site => hostname.includes(site))) {
      return false;
    }

    switch (mode) {
      case 'off':
        return false;
      case 'shadow':
        return false; // Shadow mode runs but doesn't use results
      case 'partial':
        return this.getEnabledSites().some(site => hostname.includes(site));
      case 'full':
        return true;
      default:
        return false;
    }
  }

  async autoPromote(metricsData) {
    // Auto-promote sites that meet performance targets
    const promotions = [];

    for (const [hostname, data] of Object.entries(metricsData.sitesData || {})) {
      if (data.requests >= this.config.auto_promote_min_requests &&
          data.avgConfidence >= this.config.auto_promote_threshold &&
          !this.config.enabled_sites.includes(hostname)) {

        promotions.push(hostname);
        await this.addEnabledSite(hostname);
      }
    }

    if (promotions.length > 0) {
      console.log(`🚀 Auto-promoted sites to Universal Parser: ${promotions.join(', ')}`);

      // If we have enough good sites, suggest moving to partial mode
      if (this.config.enabled_sites.length >= 5 && this.getMode() === 'shadow') {
        console.log('💡 Consider switching to PARTIAL mode - you have', this.config.enabled_sites.length, 'sites ready');
      }
    }

    // Check if ready for full mode
    const avgConfidence = metricsData.avgConfidence || 0;
    const successRate = metricsData.universalSuccess / (metricsData.universalAttempts || 1);

    if (avgConfidence >= this.config.performance_targets.min_confidence &&
        successRate >= this.config.performance_targets.min_success_rate &&
        metricsData.totalRequests >= 100) {

      if (this.getMode() !== 'full') {
        console.log('🎉 Universal Parser ready for FULL MODE!');
        console.log(`   Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
      }
    }

    return promotions;
  }

  async scheduleRollout(schedule) {
    // Schedule gradual rollout
    // Format: [{ date: '2024-01-20', mode: 'partial', sites: ['zara.com', 'hm.com'] }]
    this.config.rollout_schedule = schedule;
    await this.saveConfig();
  }

  async checkSchedule() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const step of this.config.rollout_schedule) {
      if (step.date <= today && !step.completed) {
        console.log(`📅 Executing scheduled rollout: ${step.mode} for ${step.sites?.join(', ') || 'all sites'}`);

        await this.setMode(step.mode);
        if (step.sites) {
          for (const site of step.sites) {
            await this.addEnabledSite(site);
          }
        }

        step.completed = true;
        await this.saveConfig();
      }
    }
  }

  getStatus() {
    return {
      mode: this.getMode(),
      enabled_sites: this.getEnabledSites(),
      disabled_sites: this.config.disabled_sites,
      confidence_threshold: this.config.confidence_threshold,
      auto_promote: {
        threshold: this.config.auto_promote_threshold,
        min_requests: this.config.auto_promote_min_requests
      },
      performance_targets: this.config.performance_targets,
      scheduled_rollouts: this.config.rollout_schedule.filter(s => !s.completed).length,
      last_updated: this.config.last_updated
    };
  }
}

// Singleton instance
let configInstance = null;

function getUniversalConfig() {
  if (!configInstance) {
    configInstance = new UniversalParserConfig();
  }
  return configInstance;
}

module.exports = { getUniversalConfig, UniversalParserConfig };