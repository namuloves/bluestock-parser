/**
 * Test script for gradual rollout of lean parser
 */

const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:3001';

// Test URLs - mix of trusted and non-trusted domains
const testUrls = [
  // Trusted domains (should use lean parser)
  { url: 'https://www.zara.com/us/en/textured-cropped-bomber-jacket-p08073330.html', domain: 'zara.com', trusted: true },
  { url: 'https://www2.hm.com/en_us/productpage.1219920001.html', domain: 'hm.com', trusted: true },
  { url: 'https://www.nordstrom.com/s/zella-live-in-high-waist-leggings/4312529', domain: 'nordstrom.com', trusted: true },

  // Non-trusted domains (should use V3 parser in trusted_only mode)
  { url: 'https://www.net-a-porter.com/en-us/shop/product/example', domain: 'net-a-porter.com', trusted: false },
  { url: 'https://www.farfetch.com/shopping/women/example-item.aspx', domain: 'farfetch.com', trusted: false },
  { url: 'https://www.ssense.com/en-us/women/product/example', domain: 'ssense.com', trusted: false }
];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function testRollout() {
  console.log(`${colors.cyan}=================================`);
  console.log('🚀 GRADUAL ROLLOUT TEST');
  console.log(`=================================${colors.reset}\n`);

  // First, check rollout status
  try {
    console.log(`${colors.yellow}📊 Checking rollout configuration...${colors.reset}`);
    const statusResponse = await axios.get(`${BASE_URL}/api/rollout/status`);
    const status = statusResponse.data;

    console.log(`Mode: ${colors.cyan}${status.rollout.mode}${colors.reset}`);
    console.log(`Parsers: V3=${status.parsers.v3}, Lean=${status.parsers.lean}`);
    console.log(`Trusted domains: ${status.rollout.trustedDomains.join(', ')}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to get rollout status: ${error.message}${colors.reset}`);
  }

  // Test each URL
  const results = [];
  for (const test of testUrls) {
    console.log(`${colors.yellow}Testing: ${test.domain}${colors.reset}`);
    console.log(`URL: ${test.url}`);
    console.log(`Expected: ${test.trusted ? 'LEAN parser' : 'V3 parser'}`);

    try {
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/scrape`, { url: test.url }, {
        timeout: 30000
      });
      const elapsed = Date.now() - startTime;

      const success = response.data.success;
      const hasProduct = !!response.data.product;
      const productName = response.data.product?.name || response.data.product?.product_name || 'No name';

      results.push({
        domain: test.domain,
        trusted: test.trusted,
        success,
        hasProduct,
        time: elapsed,
        productName
      });

      console.log(`Result: ${success ? colors.green + '✅ Success' : colors.red + '❌ Failed'}${colors.reset}`);
      if (hasProduct) {
        console.log(`Product: ${productName.substring(0, 50)}...`);
      }
      console.log(`Time: ${elapsed}ms\n`);
    } catch (error) {
      results.push({
        domain: test.domain,
        trusted: test.trusted,
        success: false,
        hasProduct: false,
        time: 0,
        error: error.message
      });

      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
    }
  }

  // Get final metrics
  try {
    console.log(`${colors.cyan}=================================`);
    console.log('📈 ROLLOUT METRICS');
    console.log(`=================================${colors.reset}\n`);

    const metricsResponse = await axios.get(`${BASE_URL}/api/rollout/metrics`);
    const metrics = metricsResponse.data;

    console.log(`${colors.magenta}Summary:${colors.reset}`);
    console.log(`Total requests: ${metrics.summary.totalRequests}`);
    console.log(`Lean parser usage: ${metrics.summary.leanParserUsage}`);
    console.log(`Lean success rate: ${metrics.summary.leanSuccessRate}`);
    console.log(`Legacy success rate: ${metrics.summary.legacySuccessRate}`);
    console.log(`Fallbacks used: ${metrics.summary.fallbacksUsed}\n`);

    if (metrics.recommendations && metrics.recommendations.length > 0) {
      console.log(`${colors.magenta}Recommendations:${colors.reset}`);
      metrics.recommendations.forEach(rec => {
        console.log(`${colors.yellow}→ ${rec.action}${colors.reset}`);
        console.log(`  Reason: ${rec.reason}`);
        if (rec.command) {
          console.log(`  Action: ${rec.command}`);
        }
      });
    }

    // Print test summary
    console.log(`\n${colors.cyan}=================================`);
    console.log('📋 TEST SUMMARY');
    console.log(`=================================${colors.reset}\n`);

    const trustedSuccess = results.filter(r => r.trusted && r.success).length;
    const trustedTotal = results.filter(r => r.trusted).length;
    const nonTrustedSuccess = results.filter(r => !r.trusted && r.success).length;
    const nonTrustedTotal = results.filter(r => !r.trusted).length;

    console.log(`Trusted domains: ${trustedSuccess}/${trustedTotal} successful`);
    console.log(`Non-trusted domains: ${nonTrustedSuccess}/${nonTrustedTotal} successful`);
    console.log(`Overall: ${trustedSuccess + nonTrustedSuccess}/${results.length} successful`);

    // Detailed results table
    console.log(`\n${colors.cyan}Domain${' '.repeat(20)}Trusted  Success  Time${colors.reset}`);
    console.log('-'.repeat(50));
    results.forEach(r => {
      const domainPad = r.domain.padEnd(25);
      const trustedStr = r.trusted ? 'Yes' : 'No ';
      const successStr = r.success ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`;
      const timeStr = r.time ? `${r.time}ms` : 'N/A';
      console.log(`${domainPad} ${trustedStr}      ${successStr}      ${timeStr}`);
    });

  } catch (error) {
    console.error(`${colors.red}❌ Failed to get metrics: ${error.message}${colors.reset}`);
  }
}

async function testModeProgression() {
  console.log(`\n${colors.cyan}=================================`);
  console.log('🔄 MODE PROGRESSION TEST');
  console.log(`=================================${colors.reset}\n`);

  const modes = [
    { mode: 'trusted_only', description: 'Only trusted domains use lean parser' },
    { mode: 'percentage', percentage: 20, description: 'Trusted + 20% of other domains' },
    { mode: 'percentage', percentage: 50, description: 'Trusted + 50% of other domains' },
    { mode: 'primary_with_fallback', description: 'Lean primary, V3 fallback on failure' }
  ];

  console.log('Testing different rollout modes:\n');

  for (const config of modes) {
    console.log(`${colors.yellow}Setting mode: ${config.mode}${colors.reset}`);
    console.log(`Description: ${config.description}`);

    try {
      // Update configuration
      const configData = { mode: config.mode };
      if (config.percentage !== undefined) {
        configData.percentage = config.percentage;
      }

      await axios.post(`${BASE_URL}/api/rollout/config`, configData);

      // Test a non-trusted domain to see which parser is used
      const testUrl = 'https://www.farfetch.com/shopping/women/example-item.aspx';
      await axios.post(`${BASE_URL}/scrape`, { url: testUrl }, { timeout: 10000 });

      // Check metrics
      const metricsResponse = await axios.get(`${BASE_URL}/api/rollout/metrics`);
      const metrics = metricsResponse.data;

      console.log(`Result: Lean parser usage = ${metrics.summary.leanParserUsage}\n`);
    } catch (error) {
      console.log(`${colors.red}Error: ${error.message}${colors.reset}\n`);
    }
  }

  // Reset to trusted_only mode
  console.log(`${colors.cyan}Resetting to trusted_only mode...${colors.reset}`);
  await axios.post(`${BASE_URL}/api/rollout/config`, { mode: 'trusted_only' });
}

// Run the tests
async function main() {
  try {
    // Basic rollout test
    await testRollout();

    // Mode progression test (optional - uncomment to test)
    // await testModeProgression();

    console.log(`\n${colors.green}✅ Rollout test complete!${colors.reset}`);
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