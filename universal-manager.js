#!/usr/bin/env node

const { getUniversalConfig } = require('./config/universal-config');
const { getMetricsCollector } = require('./monitoring/metrics-collector');
const fs = require('fs').promises;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const config = getUniversalConfig();

  console.log('\n🧠 UNIVERSAL PARSER MANAGER\n' + '═'.repeat(40));

  switch (command) {
    case 'status':
      await showStatus();
      break;

    case 'mode':
      await setMode(args[1]);
      break;

    case 'enable':
      await enableSite(args[1]);
      break;

    case 'disable':
      await disableSite(args[1]);
      break;

    case 'metrics':
      await showMetrics();
      break;

    case 'auto-promote':
      await runAutoPromote();
      break;

    case 'schedule':
      await scheduleRollout(args.slice(1));
      break;

    case 'test':
      await testSite(args[1]);
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

async function showStatus() {
  const config = getUniversalConfig();
  const status = config.getStatus();

  console.log('\n📊 Current Configuration:');
  console.log('─'.repeat(40));
  console.log(`Mode: ${status.mode.toUpperCase()}`);
  console.log(`Confidence Threshold: ${status.confidence_threshold}`);

  if (status.enabled_sites.length > 0) {
    console.log(`\n✅ Enabled Sites (${status.enabled_sites.length}):`);
    status.enabled_sites.forEach(site => console.log(`   - ${site}`));
  }

  if (status.disabled_sites.length > 0) {
    console.log(`\n❌ Disabled Sites (${status.disabled_sites.length}):`);
    status.disabled_sites.forEach(site => console.log(`   - ${site}`));
  }

  console.log(`\n🎯 Performance Targets:`);
  console.log(`   Min Confidence: ${status.performance_targets.min_confidence}`);
  console.log(`   Max Response Time: ${status.performance_targets.max_response_time}ms`);
  console.log(`   Min Success Rate: ${status.performance_targets.min_success_rate}`);

  console.log(`\n🚀 Auto-Promotion:`);
  console.log(`   Threshold: ${status.auto_promote.threshold}`);
  console.log(`   Min Requests: ${status.auto_promote.min_requests}`);

  if (status.scheduled_rollouts > 0) {
    console.log(`\n📅 Scheduled Rollouts: ${status.scheduled_rollouts} pending`);
  }

  console.log(`\n⏰ Last Updated: ${status.last_updated}`);

  // Show mode-specific guidance
  console.log('\n💡 Mode Guide:');
  switch (status.mode) {
    case 'shadow':
      console.log('   Running in SHADOW mode - collecting data without using results');
      console.log('   Next step: Enable PARTIAL mode when sites show good performance');
      break;
    case 'partial':
      console.log('   Running in PARTIAL mode - using Universal Parser for selected sites');
      console.log('   Next step: Add more sites or switch to FULL mode');
      break;
    case 'full':
      console.log('   Running in FULL mode - Universal Parser active for all sites');
      console.log('   Monitor performance and disable problematic sites if needed');
      break;
    case 'off':
      console.log('   Universal Parser is OFF');
      console.log('   Enable with: universal-manager mode shadow');
      break;
  }
}

async function setMode(mode) {
  if (!mode) {
    console.error('❌ Please specify a mode: off, shadow, partial, or full');
    return;
  }

  const config = getUniversalConfig();

  try {
    await config.setMode(mode);
    console.log(`✅ Mode set to: ${mode.toUpperCase()}`);

    if (mode === 'partial' && config.getEnabledSites().length === 0) {
      console.log('\n⚠️  No sites enabled for partial mode');
      console.log('   Add sites with: universal-manager enable <hostname>');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function enableSite(hostname) {
  if (!hostname) {
    console.error('❌ Please specify a hostname (e.g., zara.com)');
    return;
  }

  const config = getUniversalConfig();
  await config.addEnabledSite(hostname);
  console.log(`✅ Enabled Universal Parser for: ${hostname}`);

  const mode = config.getMode();
  if (mode !== 'partial' && mode !== 'full') {
    console.log('\n💡 Note: Currently in', mode.toUpperCase(), 'mode');
    console.log('   Switch to PARTIAL mode to use Universal Parser for this site');
  }
}

async function disableSite(hostname) {
  if (!hostname) {
    console.error('❌ Please specify a hostname');
    return;
  }

  const config = getUniversalConfig();
  await config.addDisabledSite(hostname);
  console.log(`✅ Disabled Universal Parser for: ${hostname}`);
}

async function showMetrics() {
  const collector = getMetricsCollector();
  const summary = collector.getSessionSummary();

  console.log('\n📊 Performance Metrics:');
  console.log('─'.repeat(40));

  if (summary.totalRequests === 0) {
    console.log('No metrics collected yet. Run some requests first.');
    return;
  }

  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Universal Success Rate: ${summary.universalSuccessRate}`);
  console.log(`Average Confidence: ${summary.avgConfidence}`);
  console.log(`Average Response Time: ${summary.avgResponseTime}`);

  console.log('\n🏆 Top Performing Sites:');
  const topSites = summary.topSites || [];
  topSites.forEach((site, i) => {
    console.log(`   ${i + 1}. ${site.hostname}: ${(site.avgConfidence * 100).toFixed(0)}% confidence (${site.requests} requests)`);
  });

  console.log('\n📈 Field Extraction Success:');
  const rates = summary.fieldExtractionRates || {};
  console.log(`   Product Name: ${rates.name || 'N/A'}`);
  console.log(`   Price: ${rates.price || 'N/A'}`);
  console.log(`   Images: ${rates.images || 'N/A'}`);
  console.log(`   Brand: ${rates.brand || 'N/A'}`);
}

async function runAutoPromote() {
  console.log('\n🤖 Running auto-promotion check...');

  const config = getUniversalConfig();
  const collector = getMetricsCollector();

  // Load metrics data
  const metricsFile = `./monitoring/data/${new Date().toISOString().split('T')[0]}.json`;
  try {
    const metricsData = JSON.parse(await fs.readFile(metricsFile, 'utf8'));
    const promoted = await config.autoPromote(metricsData);

    if (promoted.length > 0) {
      console.log(`✅ Promoted ${promoted.length} sites`);
    } else {
      console.log('No sites meet auto-promotion criteria yet');

      // Show sites close to promotion
      const close = [];
      for (const [hostname, data] of Object.entries(metricsData.sitesData || {})) {
        if (data.avgConfidence >= 0.6 && data.requests >= 5) {
          close.push({
            hostname,
            confidence: data.avgConfidence,
            requests: data.requests
          });
        }
      }

      if (close.length > 0) {
        console.log('\n📊 Sites approaching promotion threshold:');
        close.forEach(site => {
          console.log(`   ${site.hostname}: ${(site.confidence * 100).toFixed(0)}% (needs ${config.config.auto_promote_min_requests - site.requests} more requests)`);
        });
      }
    }
  } catch (error) {
    console.log('No metrics data available for today');
  }
}

async function scheduleRollout(args) {
  if (args.length < 3) {
    console.error('❌ Usage: universal-manager schedule <date> <mode> <sites>');
    console.error('   Example: universal-manager schedule 2024-01-25 partial zara.com,hm.com');
    return;
  }

  const [date, mode, sitesStr] = args;
  const sites = sitesStr ? sitesStr.split(',') : [];

  const config = getUniversalConfig();
  const schedule = [{
    date,
    mode,
    sites: sites.length > 0 ? sites : undefined,
    completed: false
  }];

  await config.scheduleRollout(schedule);
  console.log(`✅ Scheduled rollout for ${date}:`);
  console.log(`   Mode: ${mode}`);
  if (sites.length > 0) {
    console.log(`   Sites: ${sites.join(', ')}`);
  }
}

async function testSite(url) {
  if (!url) {
    console.error('❌ Please provide a URL to test');
    return;
  }

  console.log(`\n🧪 Testing Universal Parser on: ${url}`);
  console.log('─'.repeat(40));

  const UniversalParser = require('./universal-parser');
  const parser = new UniversalParser();

  try {
    const startTime = Date.now();
    const result = await parser.parse(url);
    const endTime = Date.now();

    console.log(`✅ Parse successful in ${endTime - startTime}ms`);
    console.log(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log('\nExtracted Data:');
    console.log(`   Name: ${result.name || '(not found)'}`);
    console.log(`   Price: ${result.price || '(not found)'}`);
    console.log(`   Brand: ${result.brand || '(not found)'}`);
    console.log(`   Images: ${result.images?.length || 0} found`);
    console.log(`   Description: ${result.description ? result.description.substring(0, 50) + '...' : '(not found)'}`);

    console.log('\nData Sources:');
    console.log(`   Name from: ${result.name_source || 'none'}`);
    console.log(`   Price from: ${result.price_source || 'none'}`);
    console.log(`   Brand from: ${result.brand_source || 'none'}`);

    if (result.confidence >= 0.7) {
      console.log('\n✅ This site is ready for Universal Parser!');
    } else {
      console.log('\n⚠️  Confidence too low. Site needs specific scraper.');
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

function showHelp() {
  console.log(`
Universal Parser Manager - Control and monitor the Universal Parser system

Usage: universal-manager <command> [options]

Commands:
  status              Show current configuration and status
  mode <mode>         Set parser mode (off, shadow, partial, full)
  enable <site>       Enable Universal Parser for a site
  disable <site>      Disable Universal Parser for a site
  metrics             Show performance metrics
  auto-promote        Check and promote well-performing sites
  schedule            Schedule gradual rollout
  test <url>          Test Universal Parser on a specific URL
  help                Show this help message

Examples:
  universal-manager status
  universal-manager mode partial
  universal-manager enable zara.com
  universal-manager test https://www.zara.com/product.html
  universal-manager metrics
  universal-manager auto-promote

Current Mode: ${getUniversalConfig().getMode().toUpperCase()}
`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };