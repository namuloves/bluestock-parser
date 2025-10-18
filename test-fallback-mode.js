/**
 * Test script to verify fallback mode is working correctly
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function testFallbackMode() {
  console.log(`${colors.cyan}=================================`);
  console.log('🔄 FALLBACK MODE TEST');
  console.log(`=================================${colors.reset}\n`);

  // First, verify we're in fallback mode
  try {
    const statusResponse = await axios.get(`${BASE_URL}/api/rollout/status`);
    const status = statusResponse.data;

    console.log(`Current mode: ${colors.cyan}${status.rollout.mode}${colors.reset}`);

    if (status.rollout.mode !== 'primary_with_fallback') {
      console.log(`${colors.yellow}⚠️  Not in fallback mode. Setting it now...${colors.reset}`);
      await axios.post(`${BASE_URL}/api/rollout/config`, {
        mode: 'primary_with_fallback'
      });
      console.log(`${colors.green}✅ Switched to primary_with_fallback mode${colors.reset}\n`);
    } else {
      console.log(`${colors.green}✅ Already in primary_with_fallback mode${colors.reset}\n`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Failed to check/set mode: ${error.message}${colors.reset}`);
    return;
  }

  // Test URLs that might trigger fallback
  const testCases = [
    {
      url: 'https://www.zara.com/us/en/textured-knit-sweater-p05536307.html',
      description: 'Zara (has recipe, should succeed with lean)'
    },
    {
      url: 'https://www.farfetch.com/shopping/women/balenciaga-hourglass-bag-item-15439934.aspx',
      description: 'Farfetch (no recipe, might need fallback)'
    },
    {
      url: 'https://www.ssense.com/en-us/women/product/ganni/black-recycled-rubber-city-boots/7487431',
      description: 'SSENSE (complex SPA, likely needs fallback)'
    },
    {
      url: 'https://www.net-a-porter.com/en-us/shop/product/saint-laurent/bags/cross-body/lou-quilted-leather-shoulder-bag/17957409491989397',
      description: 'Net-a-Porter (no recipe, might need fallback)'
    }
  ];

  // Reset metrics before test
  try {
    await axios.post(`${BASE_URL}/api/rollout/reset`);
    console.log(`${colors.cyan}📊 Metrics reset for clean test${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Could not reset metrics${colors.reset}\n`);
  }

  // Test each URL
  for (const test of testCases) {
    console.log(`${colors.yellow}Testing: ${test.description}${colors.reset}`);
    console.log(`URL: ${test.url.substring(0, 60)}...`);

    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/scrape`, {
        url: test.url
      }, {
        timeout: 30000
      });
      const elapsed = Date.now() - startTime;

      const success = response.data.success;
      const productName = response.data.product?.name || response.data.product?.product_name;

      console.log(`Result: ${success ? colors.green + '✅ Success' : colors.red + '❌ Failed'}${colors.reset}`);
      if (productName) {
        console.log(`Product: ${productName.substring(0, 50)}...`);
      }
      console.log(`Time: ${elapsed}ms\n`);

    } catch (error) {
      console.log(`${colors.red}❌ Request failed: ${error.message}${colors.reset}\n`);
    }
  }

  // Check final metrics to see if fallbacks were used
  try {
    console.log(`${colors.cyan}=================================`);
    console.log('📈 FALLBACK METRICS');
    console.log(`=================================${colors.reset}\n`);

    const metricsResponse = await axios.get(`${BASE_URL}/api/rollout/metrics`);
    const metrics = metricsResponse.data;

    console.log(`${colors.magenta}Results:${colors.reset}`);
    console.log(`Total requests: ${metrics.detailed.totalRequests}`);
    console.log(`Lean parser attempts: ${metrics.detailed.leanParserUsed}`);
    console.log(`Lean parser successes: ${colors.green}${metrics.detailed.leanParserSuccess}${colors.reset}`);
    console.log(`Lean parser failures: ${colors.red}${metrics.detailed.leanParserFailures}${colors.reset}`);
    console.log(`${colors.cyan}Fallbacks used: ${metrics.detailed.fallbacksUsed}${colors.reset}`);
    console.log(`Legacy parser successes: ${metrics.detailed.legacyParserSuccess}`);
    console.log(`Legacy parser failures: ${metrics.detailed.legacyParserFailures}\n`);

    // Show domain breakdown
    if (Object.keys(metrics.detailed.byDomain).length > 0) {
      console.log(`${colors.magenta}By Domain:${colors.reset}`);
      for (const [domain, stats] of Object.entries(metrics.detailed.byDomain)) {
        const leanRate = stats.leanSuccess / Math.max(stats.leanSuccess + stats.leanFailure, 1) * 100;
        const legacyRate = stats.legacySuccess / Math.max(stats.legacySuccess + stats.legacyFailure, 1) * 100;

        console.log(`\n${domain}:`);
        console.log(`  Lean: ${stats.leanSuccess}/${stats.leanSuccess + stats.leanFailure} (${leanRate.toFixed(0)}%)`);
        if (stats.legacySuccess + stats.legacyFailure > 0) {
          console.log(`  Legacy (fallback): ${stats.legacySuccess}/${stats.legacySuccess + stats.legacyFailure} (${legacyRate.toFixed(0)}%)`);
        }
      }
    }

    // Analysis
    console.log(`\n${colors.cyan}=================================`);
    console.log('📋 ANALYSIS');
    console.log(`=================================${colors.reset}\n`);

    const fallbackRate = (metrics.detailed.fallbacksUsed / Math.max(metrics.detailed.totalRequests, 1)) * 100;
    const leanSuccessRate = (metrics.detailed.leanParserSuccess / Math.max(metrics.detailed.leanParserUsed, 1)) * 100;

    console.log(`Fallback rate: ${colors.cyan}${fallbackRate.toFixed(1)}%${colors.reset}`);
    console.log(`Lean parser success rate: ${colors.cyan}${leanSuccessRate.toFixed(1)}%${colors.reset}`);

    if (fallbackRate > 50) {
      console.log(`\n${colors.yellow}⚠️  High fallback rate detected!${colors.reset}`);
      console.log('Consider adding recipes for failing domains or improving lean parser');
    } else if (fallbackRate < 10) {
      console.log(`\n${colors.green}✅ Low fallback rate - lean parser performing well!${colors.reset}`);
      console.log('Could consider moving to full lean parser mode soon');
    } else {
      console.log(`\n${colors.cyan}ℹ️  Moderate fallback rate${colors.reset}`);
      console.log('System working as expected with safety net in place');
    }

    // Show recommendations
    if (metrics.recommendations && metrics.recommendations.length > 0) {
      console.log(`\n${colors.magenta}Recommendations:${colors.reset}`);
      metrics.recommendations.forEach(rec => {
        console.log(`${colors.yellow}→ ${rec.action}${colors.reset}`);
        console.log(`  ${rec.reason}`);
        if (rec.command) {
          console.log(`  Action: ${rec.command}`);
        }
      });
    }

  } catch (error) {
    console.error(`${colors.red}❌ Failed to get metrics: ${error.message}${colors.reset}`);
  }

  console.log(`\n${colors.green}✅ Fallback mode test complete!${colors.reset}`);
}

// Run the test
async function main() {
  try {
    await testFallbackMode();
  } catch (error) {
    console.error(`${colors.red}❌ Test failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Check if axios is installed
try {
  require.resolve('axios');
  main();
} catch (e) {
  console.log('Installing axios...');
  require('child_process').execSync('npm install axios', { stdio: 'inherit' });
  main();
}