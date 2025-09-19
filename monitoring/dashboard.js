#!/usr/bin/env node

const { getMetricsCollector } = require('./metrics-collector');
const fs = require('fs').promises;
const path = require('path');

async function showDashboard() {
  const collector = getMetricsCollector();

  // Generate and display report
  const report = await collector.generateReport();
  console.log(report);

  // Show session summary
  const summary = collector.getSessionSummary();
  console.log('\n📊 CURRENT SESSION METRICS');
  console.log('─'.repeat(60));
  console.log(`Recent Requests: ${summary.recentRequests}`);
  console.log(`Universal Success Rate: ${summary.universalSuccessRate}`);
  console.log(`Average Confidence: ${summary.avgConfidence}`);
  console.log(`Average Response Time: ${summary.avgResponseTime}`);

  // Show recommendations for gradual rollout
  console.log('\n🚀 GRADUAL ROLLOUT RECOMMENDATIONS');
  console.log('─'.repeat(60));

  const sites = summary.topSites || [];
  const readySites = sites.filter(s => s.avgConfidence > 0.7 && s.requests > 5);

  if (readySites.length > 0) {
    console.log('\n✅ Sites ready for Universal Parser:');
    readySites.forEach(site => {
      console.log(`   ${site.hostname}: ${(site.avgConfidence * 100).toFixed(0)}% confidence`);
    });

    console.log('\n💡 To enable for these sites, run:');
    console.log(`   export UNIVERSAL_MODE=partial`);
    console.log(`   export UNIVERSAL_SITES=${readySites.map(s => s.hostname).join(',')}`);
  } else {
    console.log('⏳ Need more data. Keep running in shadow mode to collect metrics.');
  }

  // Check if ready for full mode
  const overallSuccess = summary.universalSuccessRate ? parseFloat(summary.universalSuccessRate) : 0;
  const overallConfidence = summary.avgConfidence ? parseFloat(summary.avgConfidence) : 0;

  if (overallSuccess > 70 && overallConfidence > 0.7) {
    console.log('\n🎉 READY FOR FULL MODE!');
    console.log('   Your Universal Parser is performing well enough for production.');
    console.log('   Enable with: export UNIVERSAL_MODE=full');
  }
}

// Command line interface
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'show':
    case undefined:
      await showDashboard();
      break;

    case 'watch':
      // Show dashboard and refresh every 5 seconds
      console.clear();
      await showDashboard();
      setInterval(async () => {
        console.clear();
        await showDashboard();
      }, 5000);
      break;

    case 'export':
      // Export metrics to file
      const collector = getMetricsCollector();
      const report = await collector.generateReport();
      const filename = `metrics-export-${new Date().toISOString().split('T')[0]}.txt`;
      await fs.writeFile(filename, report);
      console.log(`✅ Metrics exported to ${filename}`);
      break;

    case 'reset':
      // Reset metrics (use with caution)
      console.log('⚠️  This will reset all metrics. Are you sure? (y/n)');
      process.stdin.once('data', async (data) => {
        if (data.toString().trim().toLowerCase() === 'y') {
          const metricsDir = path.join(__dirname, 'data');
          try {
            await fs.rmdir(metricsDir, { recursive: true });
            console.log('✅ Metrics reset');
          } catch (e) {
            console.error('❌ Failed to reset metrics:', e.message);
          }
        }
        process.exit(0);
      });
      break;

    case 'help':
    default:
      console.log(`
Universal Parser Metrics Dashboard

Usage: node monitoring/dashboard.js [command]

Commands:
  show     Display current metrics (default)
  watch    Live update dashboard every 5 seconds
  export   Export metrics to file
  reset    Reset all metrics data
  help     Show this help message

Examples:
  node monitoring/dashboard.js
  node monitoring/dashboard.js watch
  node monitoring/dashboard.js export
`);
      break;
  }
}

// Run CLI if executed directly
if (require.main === module) {
  cli().catch(console.error);
}

module.exports = { showDashboard };