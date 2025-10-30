const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');

/**
 * Recipe-based extraction plugin
 * Uses YAML recipes for deterministic, version-controlled extraction
 */
class RecipeExtractor {
  constructor(recipesPath = './recipes') {
    this.recipesPath = recipesPath;
    this.recipes = new Map();
    this.loadRecipes();
  }

  /**
   * Load all YAML recipes from the recipes directory
   */
  loadRecipes() {
    try {
      const files = fs.readdirSync(this.recipesPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

      for (const file of files) {
        const domain = path.basename(file, path.extname(file));
        const recipePath = path.join(this.recipesPath, file);

        try {
          const recipe = yaml.load(fs.readFileSync(recipePath, 'utf8'));

          // Validate recipe structure
          if (!recipe.selectors || !recipe.domain) {
            console.warn(`⚠️ Invalid recipe structure in ${file}`);
            continue;
          }

          this.recipes.set(domain, recipe);
          console.log(`✅ Loaded recipe for ${domain}`);
        } catch (error) {
          console.error(`❌ Failed to load recipe ${file}:`, error.message);
        }
      }

      console.log(`📚 Loaded ${this.recipes.size} recipes`);
    } catch (error) {
      console.error('❌ Failed to load recipes directory:', error.message);
    }
  }

  /**
   * Check if we have a recipe for this domain
   */
  hasRecipe(url) {
    const domain = this.getDomain(url);
    return this.recipes.has(domain);
  }

  /**
   * Extract product data using recipe
   */
  extract($, url) {
    const domain = this.getDomain(url);
    const recipe = this.recipes.get(domain);

    if (!recipe) {
      return null;
    }

    console.log(`🧑‍🍳 Using recipe for ${domain}`);

    const result = {};
    const errors = [];

    // Extract each field according to recipe
    for (const [field, config] of Object.entries(recipe.selectors)) {
      try {
        const value = this.extractField($, config);

        // Check if required field is missing
        if (config.required && !value) {
          errors.push(`Required field missing: ${field}`);
          continue;
        }

        if (value !== null && value !== undefined) {
          result[field] = value;
        }
      } catch (error) {
        console.log(`⚠️ Failed to extract ${field}: ${error.message}`);
        if (config.required) {
          errors.push(`Failed to extract required field: ${field}`);
        }
      }
    }

    // Run assertions if defined
    if (recipe.assertions) {
      const assertionErrors = this.runAssertions(result, recipe.assertions);
      errors.push(...assertionErrors);
    }

    // If there are errors with required fields, extraction failed
    if (errors.length > 0) {
      console.log(`❌ Recipe extraction failed: ${errors.join(', ')}`);
      return {
        success: false,
        errors,
        partial: result
      };
    }

    return {
      success: true,
      data: result,
      recipe: domain,
      version: recipe.version || '1.0.0'
    };
  }

  /**
   * Extract a single field based on configuration
   */
  extractField($, config) {
    // Handle static values
    if (config.value !== undefined) {
      return config.value;
    }

    // Handle selector extraction
    let value = null;

    // Try main selector
    if (config.selector) {
      value = this.extractWithSelector($, config.selector, config);
    }

    // Try fallback selectors if main selector failed
    if (!value && config.fallback) {
      for (const fallbackSelector of config.fallback) {
        value = this.extractWithSelector($, fallbackSelector, config);
        if (value) break;
      }
    }

    // Apply transformations
    if (value && config.transform) {
      value = this.applyTransform(value, config.transform);
    }

    // Apply type conversion
    if (value && config.type) {
      value = this.convertType(value, config.type);
    }

    return value;
  }

  /**
   * Extract value using a selector
   */
  extractWithSelector($, selector, config) {
    const element = $(selector);

    if (element.length === 0) {
      return null;
    }

    // Handle different extraction types
    if (config.type === 'images') {
      const images = [];
      console.log(`🔍 RecipeExtractor: Found ${element.length} elements matching selector "${selector}"`);
      element.each((i, el) => {
        const attr = config.attribute || 'src';
        const img = $(el).attr(attr);
        if (img) {
          images.push(img);
          // Log first 3 images for debugging
          if (i < 3) {
            console.log(`  📸 Image ${i + 1}: ${img.substring(0, 100)}...`);
          }
        }
      });
      console.log(`  📊 Total images extracted: ${images.length}`);
      return images.length > 0 ? images : null;
    }

    // Extract based on attribute or text
    if (config.attribute) {
      return element.first().attr(config.attribute);
    }

    return element.first().text().trim();
  }

  /**
   * Apply transformation to extracted value
   */
  applyTransform(value, transform) {
    switch (transform) {
      case 'extractNumber':
        // Extract numeric value from string
        const match = String(value).match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : null;

      case 'high_quality':
        // Transform image URLs to high quality versions
        if (Array.isArray(value)) {
          return value.map(img => this.transformImageUrl(img));
        }
        return this.transformImageUrl(value);

      case 'lowercase':
        return String(value).toLowerCase();

      case 'uppercase':
        return String(value).toUpperCase();

      case 'trim':
        return String(value).trim();

      default:
        return value;
    }
  }

  /**
   * Transform image URL to high quality version
   */
  transformImageUrl(url) {
    if (!url) return url;

    // Zara: append ?w=1920
    if (url.includes('zara.com')) {
      return url.includes('?') ? url + '&w=1920' : url + '?w=1920';
    }

    // H&M: replace with main product image
    if (url.includes('hm.com')) {
      return url.replace(/call=url\[file:.+?\]/, 'call=url[file:/product/main]');
    }

    // Shopify: use 2048x2048
    if (url.includes('shopify')) {
      return url.replace(/_\d+x\d+/, '_2048x2048');
    }

    return url;
  }

  /**
   * Convert value to specified type
   */
  convertType(value, type) {
    switch (type) {
      case 'price':
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? null : num;

      case 'text':
      case 'string':
        return String(value);

      case 'boolean':
        return Boolean(value);

      case 'images':
        return Array.isArray(value) ? value : [value];

      case 'availability':
        // Already handled in mapping
        return value;

      default:
        return value;
    }
  }

  /**
   * Run assertions to validate extracted data
   */
  runAssertions(data, assertions) {
    const errors = [];

    for (const assertion of assertions) {
      try {
        // Create a safe evaluation context
        const context = { ...data };

        // Simple assertion parser (safe subset)
        if (!this.evaluateAssertion(assertion, context)) {
          errors.push(`Assertion failed: ${assertion}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not evaluate assertion: ${assertion}`);
      }
    }

    return errors;
  }

  /**
   * Safely evaluate simple assertions
   */
  evaluateAssertion(assertion, data) {
    // Parse simple assertions like "price > 0"
    const patterns = [
      /^(\w+)\s*>\s*([\d.]+)$/,  // field > number
      /^(\w+)\s*<\s*([\d.]+)$/,  // field < number
      /^(\w+)\s*==\s*(.+)$/,     // field == value
      /^(\w+)\s*!=\s*(.+)$/,     // field != value
      /^(\w+)\.length\s*>=\s*(\d+)$/, // field.length >= number
      /^(\w+)\[0\]\.startsWith\(['"](.+)['"]\)$/ // field[0].startsWith('...')
    ];

    for (const pattern of patterns) {
      const match = assertion.match(pattern);
      if (match) {
        const [_, field, value] = match;

        if (pattern.source.includes('>')) {
          return data[field] > parseFloat(value);
        }
        if (pattern.source.includes('<')) {
          return data[field] < parseFloat(value);
        }
        if (pattern.source.includes('==')) {
          return data[field] == value;
        }
        if (pattern.source.includes('!=')) {
          return data[field] != value;
        }
        if (pattern.source.includes('length')) {
          return data[field] && data[field].length >= parseInt(value);
        }
        if (pattern.source.includes('startsWith')) {
          return data[field] && data[field][0] && data[field][0].startsWith(value);
        }
      }
    }

    // Special case for simple field checks
    if (/^\w+$/.test(assertion)) {
      return !!data[assertion];
    }

    return true; // Default to passing if we can't evaluate
  }

  /**
   * Get domain from URL
   */
  getDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  /**
   * Reload recipes (useful for development)
   */
  reloadRecipes() {
    this.recipes.clear();
    this.loadRecipes();
  }

  /**
   * Get recipe for a domain
   */
  getRecipe(domain) {
    return this.recipes.get(domain);
  }

  /**
   * Get all loaded domains
   */
  getLoadedDomains() {
    return Array.from(this.recipes.keys());
  }
}

module.exports = RecipeExtractor;