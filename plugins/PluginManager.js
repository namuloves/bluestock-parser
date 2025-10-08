const RecipeExtractor = require('./RecipeExtractor');
const JsonLdPlugin = require('./JsonLdPlugin');
const MicrodataPlugin = require('./MicrodataPlugin');
const OpenGraphPlugin = require('./OpenGraphPlugin');
const GenericExtractor = require('./GenericExtractor');

/**
 * Plugin Manager - Orchestrates extraction plugins
 * Runs plugins in priority order and merges results deterministically
 */
class PluginManager {
  constructor() {
    // Initialize plugins
    this.plugins = [];
    this.initializePlugins();
  }

  /**
   * Initialize all available plugins in priority order
   */
  initializePlugins() {
    // Priority order (highest first)
    const pluginClasses = [
      { Plugin: RecipeExtractor, priority: 100 },  // Recipes have highest priority
      { Plugin: JsonLdPlugin, priority: 90 },      // Structured data is reliable
      { Plugin: MicrodataPlugin, priority: 80 },   // Microdata next
      { Plugin: OpenGraphPlugin, priority: 70 },   // OpenGraph metadata
      { Plugin: GenericExtractor, priority: 50 }   // Generic fallback - should work on any site
    ];

    for (const { Plugin, priority } of pluginClasses) {
      try {
        const plugin = new Plugin();
        plugin.priority = priority;
        this.plugins.push(plugin);
        console.log(`✅ Loaded plugin: ${plugin.constructor.name} (priority: ${priority})`);
      } catch (error) {
        console.warn(`⚠️ Failed to load plugin:`, error.message);
      }
    }

    // Sort by priority
    this.plugins.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Extract product data using all available plugins
   */
  async extract($, url, options = {}) {
    const results = [];
    const timing = {};

    console.log(`🔌 Running ${this.plugins.length} extraction plugins...`);

    // Run each plugin
    for (const plugin of this.plugins) {
      const startTime = Date.now();

      try {
        // Check if plugin can handle this page
        if (plugin.canHandle && !plugin.canHandle($, url)) {
          console.log(`⏭️ Skipping ${plugin.constructor.name} - cannot handle`);
          continue;
        }

        // Run extraction
        const result = await plugin.extract($, url, options);

        if (result && (result.success || Object.keys(result.data || result).length > 0)) {
          const extractedData = result.data || result;

          results.push({
            plugin: plugin.constructor.name,
            priority: plugin.priority,
            data: extractedData,
            fields: Object.keys(extractedData).filter(k => !k.startsWith('_')),
            success: result.success !== false,
            errors: result.errors || []
          });

          console.log(`✅ ${plugin.constructor.name}: extracted ${Object.keys(extractedData).length} fields`);
        } else {
          console.log(`❌ ${plugin.constructor.name}: no data extracted`);
        }

      } catch (error) {
        console.error(`❌ ${plugin.constructor.name} failed:`, error.message);
      }

      timing[plugin.constructor.name] = Date.now() - startTime;
    }

    // Merge results deterministically
    const merged = this.mergeResults(results);
    merged._extraction_metadata = {
      plugins_used: results.map(r => r.plugin),
      timing,
      timestamp: new Date().toISOString()
    };

    return merged;
  }

  /**
   * Merge results from multiple plugins deterministically
   * First valid value wins (based on priority)
   */
  mergeResults(results) {
    const merged = {};
    const fields = ['name', 'price', 'sale_price', 'images', 'brand', 'description', 'currency', 'availability'];

    // For each field, take the first valid value from highest priority plugin
    for (const field of fields) {
      for (const result of results) {
        if (!result.success && result.errors?.length > 0) {
          continue; // Skip failed extractions
        }

        const value = result.data[field];

        if (this.isValidValue(value, field)) {
          merged[field] = value;
          merged[`_${field}_source`] = result.plugin;
          break; // First valid value wins
        }
      }
    }

    // Merge any additional fields not in standard list
    for (const result of results) {
      if (!result.success && result.errors?.length > 0) continue;

      for (const [key, value] of Object.entries(result.data)) {
        if (!fields.includes(key) && !key.startsWith('_') && !merged[key]) {
          merged[key] = value;
          merged[`_${key}_source`] = result.plugin;
        }
      }
    }

    return merged;
  }

  /**
   * Check if a value is valid for a given field
   */
  isValidValue(value, field) {
    if (value === null || value === undefined) return false;

    switch (field) {
      case 'name':
        return typeof value === 'string' && value.length > 0;

      case 'price':
      case 'sale_price':
        return typeof value === 'number' && value > 0;

      case 'images':
        return Array.isArray(value) && value.length > 0;

      case 'brand':
      case 'description':
      case 'currency':
        return typeof value === 'string' && value.length > 0;

      case 'availability':
        return ['in_stock', 'out_of_stock', 'preorder', 'limited'].includes(value);

      default:
        return true;
    }
  }

  /**
   * Get plugin by name
   */
  getPlugin(name) {
    return this.plugins.find(p => p.constructor.name === name);
  }

  /**
   * Add a new plugin dynamically
   */
  addPlugin(plugin, priority = 50) {
    plugin.priority = priority;
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);
    console.log(`➕ Added plugin: ${plugin.constructor.name} (priority: ${priority})`);
  }

  /**
   * Remove a plugin
   */
  removePlugin(name) {
    const index = this.plugins.findIndex(p => p.constructor.name === name);
    if (index !== -1) {
      this.plugins.splice(index, 1);
      console.log(`➖ Removed plugin: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get list of loaded plugins
   */
  getPluginList() {
    return this.plugins.map(p => ({
      name: p.constructor.name,
      priority: p.priority,
      enabled: true
    }));
  }

  /**
   * Reload all plugins
   */
  reload() {
    this.plugins = [];
    this.initializePlugins();
  }
}

// Singleton instance
let pluginManager = null;

module.exports = {
  getPluginManager: () => {
    if (!pluginManager) {
      pluginManager = new PluginManager();
    }
    return pluginManager;
  },
  PluginManager
};