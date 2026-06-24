#!/usr/bin/env node

/**
 * Quick script to check current parser metrics and rates
 */

const axios = require('axios');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

async function checkMetrics() {
  try {
    const response = await axios.get('http://localhost:3001/api/rollout/metrics');
    const metrics = response.data;

    console.log(`\n${colors.cyan}${colors.bold}📊 PARSER METRICS DASHBOARD${colors.reset}`);
    console.log('═'.repeat(50));

    // Calculate rates
    const totalRequests = metrics.detailed.totalRequests || 0;
    const leanUsed = metrics.detailed.leanParserUsed || 0;
    const leanSuccess = metrics.detailed.leanParserSuccess || 0;
    const leanFailures = metrics.detailed.leanParserFailures || 0;
    const legacySuccess = metrics.detailed.legacyParserSuccess || 0;
    const legacyFailures = metrics.detailed.legacyParserFailures || 0;
    const fallbacks = metrics.detailed.fallbacksUsed || 0;

    // Calculate percentages
    const leanSuccessRate = leanUsed > 0 ? (leanSuccess / leanUsed * 100).toFixed(1) : 0;
    const fallbackRate = totalRequests > 0 ? (fallbacks / totalRequests * 100).toFixed(1) : 0;
    const leanCoverage = totalRequests > 0 ? (leanUsed / totalRequests * 100).toFixed(1) : 0;

    // Display summary
    console.log(`\n${colors.magenta}Mode:${colors.reset} ${colors.cyan}${metrics.mode}${colors.reset}`);
    console.log(`${colors.magenta}Total Requests:${colors.reset} ${totalRequests}`);

    console.log(`\n${colors.bold}LEAN PARSER:${colors.reset}`);
    console.log(`  Attempts: ${leanUsed} (${leanCoverage}% of traffic)`);
    console.log(`  Success: ${colors.green}${leanSuccess}${colors.reset} | Failures: ${colors.red}${leanFailures}${colors.reset}`);
    console.log(`  Success Rate: ${leanSuccessRate >= 90 ? colors.green : leanSuccessRate >= 70 ? colors.yellow : colors.red}${leanSuccessRate}%${colors.reset}`);

    console.log(`\n${colors.bold}FALLBACK (V3):${colors.reset}`);
    console.log(`  Times Used: ${fallbacks}`);
    console.log(`  Fallback Rate: ${fallbackRate <= 10 ? colors.green : fallbackRate <= 30 ? colors.yellow : colors.red}${fallbackRate}%${colors.reset}`);
    console.log(`  V3 Success: ${colors.green}${legacySuccess}${colors.reset} | V3 Failures: ${colors.red}${legacyFailures}${colors.reset}`);

    // Performance indicator
    console.log(`\n${colors.bold}HEALTH STATUS:${colors.reset}`);
    if (fallbackRate <= 10 && leanSuccessRate >= 90) {
      console.log(`  ${colors.green}✅ EXCELLENT${colors.reset} - Ready for full lean mode`);
    } else if (fallbackRate <= 30 && leanSuccessRate >= 70) {
      console.log(`  ${colors.yellow}⚠️  GOOD${colors.reset} - Continue monitoring`);
    } else {
      console.log(`  ${colors.red}❌ NEEDS ATTENTION${colors.reset} - High fallback rate or low success`);
    }

    // Domain breakdown (top failures)
    if (Object.keys(metrics.detailed.byDomain || {}).length > 0) {
      console.log(`\n${colors.bold}DOMAIN PERFORMANCE:${colors.reset}`);
      const domains = Object.entries(metrics.detailed.byDomain)
        .filter(([_, stats]) => stats.total > 0)
        .sort((a, b) => {
          // Sort by lean failure rate (worst first)
          const aFailRate = a[1].leanFailure / (a[1].leanSuccess + a[1].leanFailure || 1);
          const bFailRate = b[1].leanFailure / (b[1].leanSuccess + b[1].leanFailure || 1);
          return bFailRate - aFailRate;
        })
        .slice(0, 5);

      domains.forEach(([domain, stats]) => {
        const leanTotal = stats.leanSuccess + stats.leanFailure;
        const leanRate = leanTotal > 0 ? (stats.leanSuccess / leanTotal * 100).toFixed(0) : 0;
        const legacyTotal = stats.legacySuccess + stats.legacyFailure;
        const hadFallback = legacyTotal > 0;

        const indicator = leanRate >= 90 ? '✅' : leanRate >= 50 ? '⚠️' : '❌';
        console.log(`  ${indicator} ${domain}: Lean ${leanRate}%${hadFallback ? ' (with fallback)' : ''}`);
      });
    }

    // Recommendations
    if (metrics.recommendations && metrics.recommendations.length > 0) {
      console.log(`\n${colors.bold}RECOMMENDATIONS:${colors.reset}`);
      metrics.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${colors.yellow}${rec.action}${colors.reset}`);
        console.log(`     ${rec.reason}`);
      });
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`Updated: ${new Date().toLocaleTimeString()}`);
    console.log(`\n${colors.cyan}Tip: Run 'node test-fallback-mode.js' to generate test data${colors.reset}\n`);

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`${colors.red}❌ Cannot connect to server. Is it running on port 3001?${colors.reset}`);
      console.log(`${colors.yellow}Start the server with: npm start${colors.reset}`);
    } else {
      console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    }
  }
}

// Check if axios is installed
async function main() {
  try {
    require.resolve('axios');
    await checkMetrics();
  } catch (e) {
    console.log('Installing axios...');
    require('child_process').execSync('npm install axios', { stdio: 'inherit' });
    await checkMetrics();
  }
}

main();