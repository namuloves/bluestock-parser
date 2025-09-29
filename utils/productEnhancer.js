const cheerio = require('cheerio');

/**
 * Product Enhancement Pipeline
 *
 * This module provides post-processing enhancement for parsed product data.
 * It adds color, category, material, and other attributes that improve
 * product filtering and categorization accuracy.
 *
 * Architecture:
 * - Modular enhancement modules that can run independently
 * - Graceful degradation if any enhancement fails
 * - Confidence scoring for enhancement quality
 * - Caching support for performance optimization
 */

class ProductEnhancer {
  constructor() {
    this.version = '1.0.0';
    this.enhancementModules = new Map();
    this.cache = new Map();
    this.metrics = {
      enhancements: 0,
      successes: 0,
      failures: 0,
      byModule: {}
    };

    // Initialize enhancement modules
    this.registerDefaultModules();
  }

  /**
   * Register default enhancement modules
   */
  registerDefaultModules() {
    this.registerModule('color', this.enhanceColor.bind(this));
    this.registerModule('category', this.enhanceCategory.bind(this));
    this.registerModule('material', this.enhanceMaterial.bind(this));
    this.registerModule('gender', this.enhanceGender.bind(this));
  }

  /**
   * Register a new enhancement module
   */
  registerModule(name, enhancementFunction) {
    this.enhancementModules.set(name, enhancementFunction);
    this.metrics.byModule[name] = { attempts: 0, successes: 0, failures: 0 };
  }

  /**
   * Main enhancement function
   *
   * @param {Object} productData - Basic product data from parser
   * @param {string} rawHTML - Original page HTML for analysis
   * @param {string} url - Product URL
   * @param {Object} options - Enhancement options
   * @returns {Object} Enhanced product data
   */
  async enhance(productData, rawHTML = '', url = '', options = {}) {
    const startTime = Date.now();
    this.metrics.enhancements++;

    try {
      // Prepare enhancement context
      const context = {
        productData,
        rawHTML,
        url,
        $: rawHTML ? cheerio.load(rawHTML) : null,
        urlParts: this.parseURL(url),
        options: {
          timeout: 5000,
          skipOnLowConfidence: true,
          ...options
        }
      };

      // Run enhancement modules in parallel
      const enhancementPromises = Array.from(this.enhancementModules.entries()).map(
        ([moduleName, enhanceFunction]) => this.runModuleWithSafety(moduleName, enhanceFunction, context)
      );

      // Wait for all enhancements with timeout
      const enhancements = await Promise.allSettled(enhancementPromises);

      // Merge successful enhancements
      const enhancedData = this.mergeEnhancements(productData, enhancements, context);

      // Add enhancement metadata
      enhancedData.enhancement_metadata = {
        enhanced_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        modules_run: enhancements.length,
        modules_successful: enhancements.filter(e => e.status === 'fulfilled').length,
        version: this.version
      };

      this.metrics.successes++;
      return enhancedData;

    } catch (error) {
      console.error('❌ Product enhancement failed:', error);
      this.metrics.failures++;

      // Return original data on failure (graceful degradation)
      return {
        ...productData,
        enhancement_metadata: {
          enhanced_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
          error: error.message,
          fallback: true
        }
      };
    }
  }

  /**
   * Run enhancement module with error handling
   */
  async runModuleWithSafety(moduleName, enhanceFunction, context) {
    const moduleMetrics = this.metrics.byModule[moduleName];
    moduleMetrics.attempts++;

    try {
      const result = await Promise.race([
        enhanceFunction(context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${moduleName} timeout`)), context.options.timeout)
        )
      ]);

      moduleMetrics.successes++;
      return { moduleName, result, success: true };
    } catch (error) {
      moduleMetrics.failures++;
      console.log(`⚠️ ${moduleName} enhancement failed:`, error.message);
      return { moduleName, error: error.message, success: false };
    }
  }

  /**
   * Merge enhancement results with original product data
   */
  mergeEnhancements(productData, enhancements, context) {
    const enhanced = { ...productData };

    enhancements.forEach(enhancement => {
      if (enhancement.status === 'fulfilled' && enhancement.value.success) {
        const { moduleName, result } = enhancement.value;

        if (result && typeof result === 'object') {
          Object.assign(enhanced, result);
        }
      }
    });

    return enhanced;
  }

  /**
   * Parse URL into useful components
   */
  parseURL(url) {
    try {
      const urlObj = new URL(url);
      return {
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        pathSegments: urlObj.pathname.split('/').filter(Boolean),
        searchParams: urlObj.searchParams
      };
    } catch (error) {
      return { hostname: '', pathname: '', pathSegments: [], searchParams: new URLSearchParams() };
    }
  }

  /**
   * Color Enhancement Module
   */
  async enhanceColor(context) {
    const { productData, $, rawHTML, url } = context;

    // Skip if color already exists and has good confidence
    if (productData.color && productData.color.length > 2) {
      return { color: productData.color };
    }

    const colorSources = [];

    if ($) {
      // Strategy 1: Color selectors and attributes
      const colorSelectors = [
        '[data-color]',
        '.color-selector .selected',
        '.product-color',
        '[aria-label*="Color"]',
        '.selected-color',
        '.color-name'
      ];

      colorSelectors.forEach(selector => {
        $(selector).each((i, el) => {
          const colorValue = $(el).attr('data-color') ||
                           $(el).attr('aria-label') ||
                           $(el).text().trim();
          if (colorValue) colorSources.push(colorValue);
        });
      });

      // Strategy 2: Breadcrumb analysis
      $('.breadcrumb a, .breadcrumbs a, nav a').each((i, el) => {
        const text = $(el).text().trim();
        if (this.containsColorKeyword(text)) {
          colorSources.push(text);
        }
      });
    }

    // Strategy 3: Product name analysis
    if (productData.product_name || productData.name) {
      const productName = productData.product_name || productData.name;
      const nameColors = this.extractColorsFromText(productName);
      colorSources.push(...nameColors);
    }

    // Strategy 4: Description analysis
    if (productData.description) {
      const descColors = this.extractColorsFromText(productData.description);
      colorSources.push(...descColors);
    }

    // Strategy 5: URL analysis
    const urlColors = this.extractColorsFromText(url);
    colorSources.push(...urlColors);

    // Find best color match
    const bestColor = this.selectBestColor(colorSources);

    return bestColor ? { color: bestColor } : {};
  }

  /**
   * Category Enhancement Module
   */
  async enhanceCategory(context) {
    const { productData, $, url, urlParts } = context;

    // Skip if category already exists
    if (productData.category && productData.category.length > 2) {
      return { category: productData.category };
    }

    const categorySources = [];

    if ($) {
      // Strategy 1: Breadcrumb analysis
      $('.breadcrumb, .breadcrumbs, nav[aria-label*="breadcrumb"]').each((i, el) => {
        $(el).find('a, span').each((j, link) => {
          const text = $(link).text().trim();
          if (text && text.length > 1 && !text.includes('Home')) {
            categorySources.push({ source: 'breadcrumb', value: text, priority: 1 });
          }
        });
      });

      // Strategy 2: JSON-LD structured data
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonData = JSON.parse($(el).html());
          if (jsonData.category || jsonData['@type'] === 'Product') {
            const category = jsonData.category || jsonData.productType;
            if (category) {
              categorySources.push({ source: 'structured_data', value: category, priority: 2 });
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      });
    }

    // Strategy 3: URL path analysis
    if (urlParts.pathSegments.length > 0) {
      urlParts.pathSegments.forEach(segment => {
        const category = this.mapURLSegmentToCategory(segment);
        if (category) {
          categorySources.push({ source: 'url_path', value: category, priority: 3 });
        }
      });
    }

    // Strategy 4: Product name keyword analysis
    if (productData.product_name || productData.name) {
      const nameCategory = this.extractCategoryFromText(productData.product_name || productData.name);
      if (nameCategory) {
        categorySources.push({ source: 'product_name', value: nameCategory, priority: 4 });
      }
    }

    // Select best category
    const bestCategory = this.selectBestCategory(categorySources);

    return bestCategory ? { category: bestCategory } : {};
  }

  /**
   * Material Enhancement Module
   */
  async enhanceMaterial(context) {
    const { productData, $, rawHTML } = context;

    // Skip if material already exists
    if (productData.material && productData.material.length > 2) {
      return { material: productData.material };
    }

    const materialSources = [];

    if ($) {
      // Strategy 1: Look for composition/care sections
      const materialSelectors = [
        '.composition',
        '.material',
        '.fabric',
        '[data-testid*="composition"]',
        '.product-details',
        '.care-instructions'
      ];

      materialSelectors.forEach(selector => {
        $(selector).each((i, el) => {
          const text = $(el).text().trim();
          const materials = this.extractMaterialsFromText(text);
          materialSources.push(...materials);
        });
      });
    }

    // Strategy 2: Description analysis
    if (productData.description) {
      const materials = this.extractMaterialsFromText(productData.description);
      materialSources.push(...materials);
    }

    // Strategy 3: Raw HTML analysis for hidden composition
    if (rawHTML) {
      const materialMatches = rawHTML.match(/\d+%\s+[\w\s]+/g);
      if (materialMatches) {
        materialSources.push(...materialMatches);
      }
    }

    const bestMaterial = this.selectBestMaterial(materialSources);

    return bestMaterial ? { material: bestMaterial } : {};
  }

  /**
   * Gender Enhancement Module
   */
  async enhanceGender(context) {
    const { productData, $, url, urlParts } = context;

    const genderSources = [];

    // Strategy 1: URL analysis
    const urlGender = this.extractGenderFromURL(url, urlParts);
    if (urlGender) genderSources.push(urlGender);

    // Strategy 2: Breadcrumb analysis
    if ($) {
      $('.breadcrumb a, .breadcrumbs a').each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (['men', 'women', 'unisex', 'kids', 'boys', 'girls'].includes(text)) {
          genderSources.push(text);
        }
      });
    }

    // Strategy 3: Product tags/labels
    if ($) {
      $('.product-tag, .badge, .label').each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (['unisex', 'men', 'women'].includes(text)) {
          genderSources.push(text);
        }
      });
    }

    const bestGender = this.selectBestGender(genderSources);

    return bestGender ? { gender: bestGender } : {};
  }

  // Helper methods for color extraction
  containsColorKeyword(text) {
    const colorKeywords = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
      'brown', 'gray', 'grey', 'navy', 'beige', 'cream', 'ivory', 'gold', 'silver',
      'maroon', 'olive', 'teal', 'lime', 'aqua', 'fuchsia', 'coral', 'salmon',
      'apricot', 'khaki', 'tan', 'burgundy', 'rust', 'sage', 'mint'
    ];

    return colorKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  extractColorsFromText(text) {
    const colors = [];
    const colorPattern = /\b(black|white|red|blue|green|yellow|orange|purple|pink|brown|gray|grey|navy|beige|cream|ivory|gold|silver|maroon|olive|teal|lime|aqua|fuchsia|coral|salmon|apricot|khaki|tan|burgundy|rust|sage|mint)\b/gi;

    const matches = text.match(colorPattern);
    if (matches) {
      colors.push(...matches.map(match => match.toLowerCase()));
    }

    return colors;
  }

  selectBestColor(colorSources) {
    if (colorSources.length === 0) return null;

    // Remove duplicates and normalize
    const uniqueColors = [...new Set(colorSources.map(c => c.toLowerCase().trim()))];

    // Return first valid color (could be enhanced with confidence scoring)
    return uniqueColors.find(color => color.length > 2) || null;
  }

  // Helper methods for category extraction
  mapURLSegmentToCategory(segment) {
    const categoryMap = {
      'clothing': 'Clothing',
      'shoes': 'Shoes',
      'accessories': 'Accessories',
      'bags': 'Bags',
      'jewelry': 'Jewelry',
      'sweaters': 'Sweaters',
      'knitwear': 'Knitwear',
      'dresses': 'Dresses',
      'tops': 'Tops',
      'bottoms': 'Bottoms',
      'outerwear': 'Outerwear',
      'jackets': 'Jackets',
      'coats': 'Coats'
    };

    return categoryMap[segment.toLowerCase()] || null;
  }

  extractCategoryFromText(text) {
    const categoryKeywords = {
      'Sweaters': ['sweater', 'pullover', 'jumper', 'cardigan'],
      'Dresses': ['dress', 'gown', 'frock'],
      'Tops': ['shirt', 'blouse', 'top', 't-shirt', 'tank'],
      'Bottoms': ['pants', 'trousers', 'jeans', 'shorts', 'skirt'],
      'Shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'flat'],
      'Bags': ['bag', 'purse', 'handbag', 'backpack', 'tote'],
      'Jewelry': ['necklace', 'bracelet', 'ring', 'earring', 'watch']
    };

    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category;
      }
    }

    return null;
  }

  selectBestCategory(categorySources) {
    if (categorySources.length === 0) return null;

    // Sort by priority (lower number = higher priority)
    categorySources.sort((a, b) => a.priority - b.priority);

    return categorySources[0].value;
  }

  // Helper methods for material extraction
  extractMaterialsFromText(text) {
    const materials = [];

    // Look for percentage compositions
    const compositionPattern = /(\d+%\s+[\w\s]+)/g;
    const matches = text.match(compositionPattern);
    if (matches) {
      materials.push(...matches);
    }

    // Look for common materials
    const materialKeywords = [
      'cotton', 'polyester', 'wool', 'silk', 'linen', 'cashmere', 'leather',
      'denim', 'canvas', 'velvet', 'satin', 'chiffon', 'viscose', 'modal',
      'bamboo', 'hemp', 'nylon', 'acrylic', 'spandex', 'elastane'
    ];

    materialKeywords.forEach(material => {
      if (text.toLowerCase().includes(material)) {
        materials.push(material);
      }
    });

    return materials;
  }

  selectBestMaterial(materialSources) {
    if (materialSources.length === 0) return null;

    // Prefer composition strings with percentages
    const compositionMatch = materialSources.find(m => m.includes('%'));
    if (compositionMatch) return compositionMatch;

    // Otherwise return first material
    return materialSources[0];
  }

  // Helper methods for gender extraction
  extractGenderFromURL(url, urlParts) {
    const path = urlParts.pathname.toLowerCase();

    if (path.includes('/men/') || path.includes('/mens/')) return 'men';
    if (path.includes('/women/') || path.includes('/womens/')) return 'women';
    if (path.includes('/unisex/')) return 'unisex';
    if (path.includes('/kids/') || path.includes('/children/')) return 'kids';

    return null;
  }

  selectBestGender(genderSources) {
    if (genderSources.length === 0) return null;

    // Normalize and return first valid gender
    const normalizedGenders = genderSources.map(g => g.toLowerCase().trim());
    const validGenders = ['men', 'women', 'unisex', 'kids'];

    return normalizedGenders.find(g => validGenders.includes(g)) || null;
  }

  /**
   * Get enhancement metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      success_rate: this.metrics.enhancements > 0 ?
        (this.metrics.successes / this.metrics.enhancements * 100).toFixed(2) + '%' : '0%'
    };
  }
}

module.exports = ProductEnhancer;