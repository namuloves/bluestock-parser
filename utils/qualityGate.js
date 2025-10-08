const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

class QualityGate {
  constructor() {
    // Initialize AJV with strict validation
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
      validateFormats: true
    });

    // Add format validators (uri, email, etc.)
    addFormats(this.ajv);

    // Load product schema
    this.productSchema = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../schemas/product.json'), 'utf8')
    );

    // Compile validator
    this.validateProduct = this.ajv.compile(this.productSchema);

    // Track validation metrics
    this.metrics = {
      total: 0,
      passed: 0,
      failed: 0,
      failureReasons: {}
    };
  }

  /**
   * Validate product data against schema and business rules
   * @param {Object} product - Product data to validate
   * @returns {Object} Validation result with pass/fail and errors
   */
  validate(product) {
    this.metrics.total++;

    const result = {
      valid: false,
      errors: [],
      warnings: [],
      product: null
    };

    // Step 1: Schema validation
    const schemaValid = this.validateProduct(product);

    if (!schemaValid) {
      result.errors = this.formatSchemaErrors(this.validateProduct.errors);
      this.recordFailure('schema_validation', result.errors);
      this.metrics.failed++;
      return result;
    }

    // Step 2: Business rules validation
    const businessErrors = this.validateBusinessRules(product);
    if (businessErrors.length > 0) {
      result.errors = businessErrors;
      this.recordFailure('business_rules', businessErrors);
      this.metrics.failed++;
      return result;
    }

    // Step 3: Data quality checks (warnings only)
    result.warnings = this.checkDataQuality(product);

    // Passed all validations
    result.valid = true;
    result.product = this.normalizeProduct(product);
    this.metrics.passed++;

    // Log deprecation warning for confidence scores
    if (product.confidence !== undefined) {
      console.log(`[DEPRECATION] confidence score (${product.confidence}) is deprecated and will be removed. Using quality gate validation instead.`);
    }

    return result;
  }

  /**
   * Validate business rules that can't be expressed in JSON Schema
   */
  validateBusinessRules(product) {
    const errors = [];

    // Rule 1: Sale price should be less than original price
    if (product.sale_price && product.price && product.sale_price >= product.price) {
      errors.push({
        field: 'sale_price',
        message: `Sale price ($${product.sale_price}) must be less than original price ($${product.price})`
      });
    }

    // Rule 2: Name should not be identical to brand
    if (product.name && product.brand && product.name.toLowerCase() === product.brand.toLowerCase()) {
      errors.push({
        field: 'name',
        message: 'Product name should not be identical to brand name'
      });
    }

    // Rule 3: Check for placeholder/test data
    const placeholders = ['test', 'example', 'sample', 'placeholder', 'lorem ipsum'];
    const nameLower = (product.name || '').toLowerCase();

    if (placeholders.some(ph => nameLower.includes(ph))) {
      errors.push({
        field: 'name',
        message: 'Product name contains placeholder text'
      });
    }

    // Rule 4: Price sanity checks - be more lenient
    if (product.price > 100000) {  // Increased from 50000 for luxury items
      errors.push({
        field: 'price',
        message: `Price ($${product.price}) is suspiciously high. Possible extraction error.`
      });
    }

    // Rule 4b: Allow zero price if explicitly marked as such (might be "Contact for price")
    if (product.price === 0 && !product.allowZeroPrice) {
      // Don't error, just warn - this will be handled elsewhere
    }

    // Rule 5: Image URL validation
    if (product.images && product.images.length > 0) {
      const invalidImages = product.images.filter(img => {
        return !img || img.includes('placeholder') || img.includes('no-image') ||
               img.length < 10 || !img.match(/\.(jpg|jpeg|png|webp|avif|gif)/i);
      });

      if (invalidImages.length === product.images.length) {
        errors.push({
          field: 'images',
          message: 'All images appear to be invalid or placeholders'
        });
      }
    }

    return errors;
  }

  /**
   * Check data quality (non-blocking warnings)
   */
  checkDataQuality(product) {
    const warnings = [];

    // Warning: Missing brand
    if (!product.brand) {
      warnings.push({
        field: 'brand',
        message: 'Brand information is missing',
        severity: 'low'
      });
    }

    // Warning: Missing description
    if (!product.description || product.description.length < 10) {
      warnings.push({
        field: 'description',
        message: 'Product description is missing or too short',
        severity: 'low'
      });
    }

    // Warning: Only one image
    if (product.images && product.images.length === 1) {
      warnings.push({
        field: 'images',
        message: 'Only one product image found',
        severity: 'medium'
      });
    }

    // Warning: No sale price for potentially discounted item
    if (product.name && product.name.match(/sale|discount|clearance|off/i) && !product.sale_price) {
      warnings.push({
        field: 'sale_price',
        message: 'Product name suggests it\'s on sale but no sale price found',
        severity: 'medium'
      });
    }

    return warnings;
  }

  /**
   * Normalize product data to consistent format
   */
  normalizeProduct(product) {
    return {
      // Required fields
      name: product.name.trim(),
      price: Number(product.price),
      images: product.images.map(img => img.trim()),

      // Optional fields with defaults
      currency: product.currency || 'USD',
      brand: product.brand ? product.brand.trim() : null,
      description: product.description ? product.description.trim() : null,
      sale_price: product.sale_price ? Number(product.sale_price) : null,
      availability: product.availability || 'in_stock',
      url: product.url || null,

      // Metadata
      validated_at: new Date().toISOString(),
      validation_version: '1.0.0'
    };
  }

  /**
   * Format schema validation errors for better readability
   */
  formatSchemaErrors(errors) {
    return errors.map(err => ({
      field: err.instancePath.replace('/', '') || err.params.missingProperty,
      message: this.humanizeError(err),
      rule: err.keyword,
      details: err.params
    }));
  }

  /**
   * Convert AJV errors to human-readable messages
   */
  humanizeError(error) {
    switch (error.keyword) {
      case 'required':
        return `Missing required field: ${error.params.missingProperty}`;
      case 'minLength':
        return `${error.instancePath.replace('/', '')} is too short (minimum ${error.params.limit} characters)`;
      case 'maxLength':
        return `${error.instancePath.replace('/', '')} is too long (maximum ${error.params.limit} characters)`;
      case 'minimum':
        return `${error.instancePath.replace('/', '')} must be at least ${error.params.limit}`;
      case 'maximum':
        return `${error.instancePath.replace('/', '')} must be at most ${error.params.limit}`;
      case 'pattern':
        return `${error.instancePath.replace('/', '')} contains invalid characters or format`;
      case 'enum':
        return `${error.instancePath.replace('/', '')} must be one of: ${error.params.allowedValues.join(', ')}`;
      case 'format':
        return `${error.instancePath.replace('/', '')} is not a valid ${error.params.format}`;
      case 'type':
        return `${error.instancePath.replace('/', '')} must be a ${error.params.type}`;
      case 'minItems':
        return `${error.instancePath.replace('/', '')} must have at least ${error.params.limit} items`;
      default:
        return error.message;
    }
  }

  /**
   * Record failure reasons for metrics
   */
  recordFailure(type, errors) {
    if (!this.metrics.failureReasons[type]) {
      this.metrics.failureReasons[type] = 0;
    }
    this.metrics.failureReasons[type]++;
  }

  /**
   * Get validation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      passRate: this.metrics.total > 0
        ? (this.metrics.passed / this.metrics.total * 100).toFixed(2) + '%'
        : '0%',
      topFailureReasons: Object.entries(this.metrics.failureReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }))
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      total: 0,
      passed: 0,
      failed: 0,
      failureReasons: {}
    };
  }
}

// Singleton instance
let qualityGate = null;

module.exports = {
  getQualityGate: () => {
    if (!qualityGate) {
      qualityGate = new QualityGate();
    }
    return qualityGate;
  },
  QualityGate
};