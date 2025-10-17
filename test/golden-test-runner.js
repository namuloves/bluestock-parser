/**
 * Golden Dataset Test Runner
 * Validates parser against known product URLs
 */

const fs = require('fs');
const path = require('path');
const { getQualityGate } = require('../utils/qualityGate');

class GoldenTestRunner {
  constructor(parserInstance = null) {
    this.parser = parserInstance;
    this.qualityGate = getQualityGate();
    this.results = [];
    this.loadGoldenDataset();
  }

  /**
   * Load golden dataset
   */
  loadGoldenDataset() {
    const datasetPath = path.join(__dirname, 'golden', 'products.json');
    const data = fs.readFileSync(datasetPath, 'utf8');
    this.dataset = JSON.parse(data);
    console.log(`📊 Loaded golden dataset v${this.dataset.version} with ${this.dataset.tests.length} tests`);
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('\n🏃 Starting Golden Dataset Tests...\n');
    console.log('=' . repeat(50));

    const startTime = Date.now();
    this.results = [];

    for (const test of this.dataset.tests) {
      if (test.skip) {
        console.log(`⏭️ Skipping ${test.id}`);
        continue;
      }

      await this.runTest(test);
    }

    const duration = Date.now() - startTime;

    // Generate report
    const report = this.generateReport(duration);

    // Save report
    await this.saveReport(report);

    return report;
  }

  /**
   * Run single test
   */
  async runTest(test) {
    console.log(`\n🧪 Testing ${test.id} (${test.domain})...`);

    const result = {
      id: test.id,
      domain: test.domain,
      url: test.url,
      passed: false,
      errors: [],
      warnings: [],
      duration: 0,
      extractedData: null
    };

    const startTime = Date.now();

    try {
      // Skip if unreachable and marked to skip
      if (test.skip_if_unreachable) {
        const reachable = await this.checkReachability(test.url);
        if (!reachable) {
          console.log(`⏭️ Skipping unreachable URL: ${test.url}`);
          result.skipped = true;
          this.results.push(result);
          return;
        }
      }

      // Parse the URL (mock for testing - replace with actual parser)
      const extractedData = await this.parseUrl(test.url);
      result.extractedData = extractedData;

      // Validate with Quality Gate
      const validation = this.qualityGate.validate(extractedData);

      if (!validation.valid) {
        result.errors.push(...validation.errors.map(e => e.message || e));
      }

      result.warnings.push(...(validation.warnings || []));

      // Validate against expected values
      const expectedValidation = this.validateExpected(extractedData, test.expected);
      result.errors.push(...expectedValidation.errors);
      result.warnings.push(...expectedValidation.warnings);

      // Check required fields
      const missingFields = this.checkRequiredFields(extractedData, test.required_fields);
      if (missingFields.length > 0) {
        result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Determine if test passed
      result.passed = result.errors.length === 0;

      if (result.passed) {
        console.log(`✅ PASSED`);
      } else {
        console.log(`❌ FAILED: ${result.errors[0]}`);
      }

    } catch (error) {
      result.errors.push(`Exception: ${error.message}`);
      result.passed = false;
      console.log(`❌ ERROR: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    this.results.push(result);
  }

  /**
   * Parse URL (mock implementation - replace with actual parser)
   */
  async parseUrl(url) {
    if (this.parser) {
      // Use provided parser
      const result = await this.parser.parse(url);
      return result;
    }

    // Mock data for testing
    return {
      name: 'Test Product',
      price: 29.99,
      images: ['https://example.com/image1.jpg'],
      brand: 'Test Brand',
      currency: 'USD'
    };
  }

  /**
   * Check if URL is reachable
   */
  async checkReachability(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate extracted data against expected values
   */
  validateExpected(data, expected) {
    const errors = [];
    const warnings = [];

    if (!expected) return { errors, warnings };

    for (const [field, expectation] of Object.entries(expected)) {
      const value = data[field];

      // Handle different expectation types
      if (typeof expectation === 'object') {
        // Check 'contains'
        if (expectation.contains) {
          const contains = Array.isArray(expectation.contains)
            ? expectation.contains
            : [expectation.contains];

          const valueStr = String(value || '').toLowerCase();
          const hasAll = contains.every(term =>
            valueStr.includes(term.toLowerCase())
          );

          if (!hasAll) {
            errors.push(`${field} doesn't contain expected terms: ${contains.join(', ')}`);
          }
        }

        // Check 'equals'
        if (expectation.equals !== undefined) {
          if (value !== expectation.equals) {
            errors.push(`${field} expected ${expectation.equals}, got ${value}`);
          }
        }

        // Check 'min'
        if (expectation.min !== undefined) {
          if (typeof value === 'number' && value < expectation.min) {
            errors.push(`${field} (${value}) is below minimum ${expectation.min}`);
          }
        }

        // Check 'max'
        if (expectation.max !== undefined) {
          if (typeof value === 'number' && value > expectation.max) {
            errors.push(`${field} (${value}) is above maximum ${expectation.max}`);
          }
        }

        // Check 'minLength'
        if (expectation.minLength !== undefined) {
          const length = value ? String(value).length : 0;
          if (length < expectation.minLength) {
            errors.push(`${field} length (${length}) is below minimum ${expectation.minLength}`);
          }
        }

        // Check 'minCount' for arrays
        if (expectation.minCount !== undefined) {
          const count = Array.isArray(value) ? value.length : 0;
          if (count < expectation.minCount) {
            errors.push(`${field} count (${count}) is below minimum ${expectation.minCount}`);
          }
        }

      } else {
        // Simple equality check
        if (value !== expectation) {
          errors.push(`${field} expected ${expectation}, got ${value}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Check required fields
   */
  checkRequiredFields(data, requiredFields) {
    const missing = [];

    for (const field of requiredFields || []) {
      if (!data[field]) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Generate test report
   */
  generateReport(duration) {
    const passed = this.results.filter(r => r.passed && !r.skipped).length;
    const failed = this.results.filter(r => !r.passed && !r.skipped).length;
    const skipped = this.results.filter(r => r.skipped).length;
    const total = this.results.length - skipped;

    const passRate = total > 0 ? (passed / total * 100) : 0;

    // Group failures by domain
    const failuresByDomain = {};
    this.results
      .filter(r => !r.passed && !r.skipped)
      .forEach(r => {
        if (!failuresByDomain[r.domain]) {
          failuresByDomain[r.domain] = [];
        }
        failuresByDomain[r.domain].push(r);
      });

    // Check critical sites
    const criticalFailures = this.dataset.validation_rules.critical_sites
      .filter(site => failuresByDomain[site]?.length > 0);

    const report = {
      timestamp: new Date().toISOString(),
      version: this.dataset.version,
      summary: {
        total,
        passed,
        failed,
        skipped,
        passRate: passRate.toFixed(2) + '%',
        duration: (duration / 1000).toFixed(2) + 's'
      },
      criticalSites: {
        passed: this.dataset.validation_rules.critical_sites.filter(
          site => !failuresByDomain[site]
        ),
        failed: criticalFailures
      },
      failures: this.results.filter(r => !r.passed && !r.skipped),
      passed: passRate >= (this.dataset.validation_rules.pass_threshold * 100),
      qualityGateMetrics: this.qualityGate.getMetrics()
    };

    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    const reportPath = path.join(__dirname, 'golden', `report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to ${reportPath}`);
  }

  /**
   * Print summary
   */
  printSummary(report) {
    console.log('\n' + '=' . repeat(50));
    console.log('📊 GOLDEN TEST SUMMARY');
    console.log('=' . repeat(50));

    console.log(`\nResults:`);
    console.log(`  ✅ Passed: ${report.summary.passed}/${report.summary.total}`);
    console.log(`  ❌ Failed: ${report.summary.failed}/${report.summary.total}`);
    console.log(`  ⏭️ Skipped: ${report.summary.skipped}`);
    console.log(`  📈 Pass Rate: ${report.summary.passRate}`);
    console.log(`  ⏱️ Duration: ${report.summary.duration}`);

    if (report.criticalSites.failed.length > 0) {
      console.log(`\n🚨 Critical Sites Failed:`);
      report.criticalSites.failed.forEach(site => {
        console.log(`  - ${site}`);
      });
    }

    if (report.failures.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      report.failures.slice(0, 5).forEach(failure => {
        console.log(`  - ${failure.id}: ${failure.errors[0]}`);
      });
      if (report.failures.length > 5) {
        console.log(`  ... and ${report.failures.length - 5} more`);
      }
    }

    const threshold = this.dataset.validation_rules.pass_threshold * 100;
    if (report.passed) {
      console.log(`\n🎉 GOLDEN TESTS PASSED! (>${threshold}% pass rate)`);
    } else {
      console.log(`\n⚠️ GOLDEN TESTS FAILED! (Required >${threshold}% pass rate)`);
    }

    return report.passed;
  }
}

// If run directly
if (require.main === module) {
  const runner = new GoldenTestRunner();

  runner.runAll().then(report => {
    runner.printSummary(report);
    process.exit(report.passed ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = GoldenTestRunner;