// Enhanced parsing utility that combines color and category detection
const { extractColor, extractAllColors } = require('./colorExtractor');
const { detectCategory, detectAllCategories } = require('./enhancedCategoryDetection');

/**
 * Enhance product data with improved color and category detection
 * @param {Object} productData - Raw product data from scraper
 * @returns {Object} - Enhanced product data
 */
function enhanceProductData(productData) {
  // Prepare data for color extraction
  const colorData = {
    productName: productData.name || productData.title || '',
    description: productData.description || '',
    variants: productData.variants || [],
    options: productData.options || [],
    attributes: productData.attributes || {},
    metaData: productData.meta || {},
    htmlContent: productData.html || ''
  };

  // Prepare data for category detection
  const categoryData = {
    productName: productData.name || productData.title || '',
    description: productData.description || '',
    brand: productData.brand || productData.vendor || '',
    scrapedCategory: productData.category || productData.type || '',
    breadcrumbs: productData.breadcrumbs || [],
    url: productData.url || '',
    metaTags: productData.meta || {},
    structuredData: productData.structuredData || productData.jsonLd || {}
  };

  // Extract color(s)
  const primaryColor = extractColor(colorData);
  const allColors = extractAllColors(colorData);

  // Detect category
  const category = detectCategory(categoryData);
  const allCategories = detectAllCategories(categoryData);

  // Enhance the product data
  const enhanced = {
    ...productData,
    color: primaryColor || productData.color || null,
    colors: allColors.length > 0 ? allColors : (productData.colors || []),
    category: category !== 'Other' ? category : (productData.category || 'Other'),
    categories: allCategories.length > 0 ? allCategories : [category],
    
    // Add metadata about enhancement
    _enhanced: {
      colorDetected: !!primaryColor,
      categoryDetected: category !== 'Other',
      multipleColors: allColors.length > 1,
      multipleCategories: allCategories.length > 1,
      enhancedAt: new Date().toISOString()
    }
  };

  // Clean up duplicate fields
  if (enhanced.color && enhanced.colors.length === 0) {
    enhanced.colors = [enhanced.color];
  }

  return enhanced;
}

/**
 * Extract breadcrumbs from various sources
 * @param {Object} $ - Cheerio instance
 * @returns {Array} - Array of breadcrumb items
 */
function extractBreadcrumbs($) {
  const breadcrumbs = [];

  // Common breadcrumb selectors
  const selectors = [
    'nav[aria-label*="breadcrumb"] a',
    '.breadcrumb a',
    '.breadcrumbs a',
    '[itemtype*="BreadcrumbList"] [itemprop="name"]',
    'ol.breadcrumb li a',
    'ul.breadcrumb li a',
    '.navigation-breadcrumb a',
    '.product-breadcrumb a'
  ];

  for (const selector of selectors) {
    const items = $(selector);
    if (items.length > 0) {
      items.each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.toLowerCase() !== 'home') {
          breadcrumbs.push(text);
        }
      });
      if (breadcrumbs.length > 0) break;
    }
  }

  return breadcrumbs;
}

/**
 * Extract structured data from page
 * @param {Object} $ - Cheerio instance
 * @returns {Object} - Structured data
 */
function extractStructuredData($) {
  const structuredData = {};

  // Look for JSON-LD
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json['@type'] === 'Product' || json.type === 'Product') {
        Object.assign(structuredData, json);
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  // Look for microdata
  const product = $('[itemtype*="schema.org/Product"]').first();
  if (product.length) {
    structuredData.name = product.find('[itemprop="name"]').text().trim() || structuredData.name;
    structuredData.category = product.find('[itemprop="category"]').text().trim() || structuredData.category;
    structuredData.color = product.find('[itemprop="color"]').text().trim() || structuredData.color;
    structuredData.brand = product.find('[itemprop="brand"] [itemprop="name"]').text().trim() || 
                           product.find('[itemprop="brand"]').text().trim() || 
                           structuredData.brand;
  }

  return structuredData;
}

/**
 * Clean and normalize product data
 * @param {Object} data - Product data
 * @returns {Object} - Cleaned data
 */
function cleanProductData(data) {
  const cleaned = { ...data };

  // Clean strings
  ['name', 'title', 'brand', 'vendor', 'color', 'category', 'description'].forEach(field => {
    if (cleaned[field] && typeof cleaned[field] === 'string') {
      cleaned[field] = cleaned[field]
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ');
    }
  });

  // Ensure arrays
  ['images', 'colors', 'sizes', 'categories'].forEach(field => {
    if (cleaned[field] && !Array.isArray(cleaned[field])) {
      cleaned[field] = [cleaned[field]];
    }
  });

  // Remove empty values
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === '' || cleaned[key] === null || cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

module.exports = {
  enhanceProductData,
  extractBreadcrumbs,
  extractStructuredData,
  cleanProductData
};