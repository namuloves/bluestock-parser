// Enhanced color extraction utility for product parsing

// Comprehensive color mappings
const colorMappings = {
  // Basic colors
  'black': ['black', 'noir', 'nero', 'onyx', 'jet', 'ebony', 'charcoal', 'carbon', 'midnight'],
  'white': ['white', 'blanc', 'bianco', 'ivory', 'cream', 'pearl', 'snow', 'alabaster', 'chalk', 'coconut', 'vanilla', 'bone'],
  'gray': ['gray', 'grey', 'gris', 'grigio', 'silver', 'slate', 'ash', 'smoke', 'graphite', 'pewter', 'stone', 'cement', 'concrete'],
  'brown': ['brown', 'marron', 'marrone', 'tan', 'taupe', 'beige', 'camel', 'khaki', 'sand', 'nude', 'chocolate', 'coffee', 'mocha', 'espresso', 'cognac', 'caramel', 'hazelnut', 'walnut', 'chestnut', 'bronze', 'copper', 'rust', 'terracotta', 'sienna', 'umber'],
  'red': ['red', 'rouge', 'rosso', 'crimson', 'scarlet', 'burgundy', 'wine', 'maroon', 'ruby', 'cherry', 'rose', 'coral', 'salmon', 'brick', 'rust', 'vermillion', 'carmine', 'claret', 'berry', 'sangria', 'garnet'],
  'blue': ['blue', 'bleu', 'blu', 'navy', 'marine', 'royal', 'cobalt', 'sapphire', 'azure', 'sky', 'baby blue', 'powder', 'cornflower', 'teal', 'turquoise', 'aqua', 'cerulean', 'indigo', 'denim', 'midnight', 'ocean', 'steel'],
  'green': ['green', 'vert', 'verde', 'olive', 'emerald', 'jade', 'mint', 'sage', 'forest', 'lime', 'chartreuse', 'kelly', 'hunter', 'bottle', 'pine', 'seafoam', 'moss', 'army', 'military', 'khaki', 'pistachio', 'avocado'],
  'yellow': ['yellow', 'jaune', 'giallo', 'gold', 'golden', 'mustard', 'honey', 'lemon', 'canary', 'sunshine', 'butter', 'maize', 'corn', 'amber', 'saffron', 'citron', 'chartreuse'],
  'orange': ['orange', 'coral', 'peach', 'apricot', 'tangerine', 'rust', 'burnt orange', 'pumpkin', 'terracotta', 'papaya', 'melon', 'cantaloupe', 'carrot', 'amber'],
  'pink': ['pink', 'rose', 'rosa', 'blush', 'fuchsia', 'magenta', 'hot pink', 'bubblegum', 'dusty rose', 'mauve', 'salmon', 'coral', 'peach', 'flamingo', 'watermelon', 'carnation'],
  'purple': ['purple', 'violet', 'viola', 'lavender', 'lilac', 'plum', 'mauve', 'orchid', 'amethyst', 'grape', 'eggplant', 'aubergine', 'mulberry', 'magenta', 'fuchsia', 'iris', 'periwinkle'],
  
  // Multi-color patterns
  'multicolor': ['multicolor', 'multi', 'rainbow', 'colorful', 'mixed', 'print', 'pattern', 'floral', 'striped', 'plaid', 'checkered', 'tie-dye', 'ombre', 'gradient', 'animal print', 'leopard', 'zebra', 'camo', 'camouflage'],
  
  // Metallic
  'metallic': ['metallic', 'gold', 'silver', 'bronze', 'copper', 'rose gold', 'platinum', 'chrome', 'gunmetal', 'pewter', 'brass']
};

// Priority color keywords (these take precedence)
const priorityColors = [
  'black', 'white', 'navy', 'gray', 'grey', 'brown', 'tan', 'beige', 
  'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple'
];

/**
 * Extract color from product data
 * @param {Object} data - Product data containing various fields
 * @returns {string|null} - Extracted color or null
 */
function extractColor(data) {
  const {
    productName = '',
    description = '',
    variants = [],
    options = [],
    attributes = {},
    metaData = {},
    htmlContent = ''
  } = data;

  // 1. Check for explicit color in variants
  if (variants && variants.length > 0) {
    for (const variant of variants) {
      // Check common variant option names
      if (variant.color) return normalizeColor(variant.color);
      if (variant.Color) return normalizeColor(variant.Color);
      if (variant.colour) return normalizeColor(variant.colour);
      if (variant.Colour) return normalizeColor(variant.Colour);
      
      // Check variant options (option1, option2, etc.)
      for (let i = 1; i <= 3; i++) {
        const option = variant[`option${i}`];
        if (option) {
          const color = detectColorFromText(option);
          if (color) return color;
        }
      }
    }
  }

  // 2. Check product options
  if (options && options.length > 0) {
    for (const option of options) {
      if (option.name && option.name.toLowerCase().includes('color')) {
        if (option.values && option.values.length > 0) {
          return normalizeColor(option.values[0]);
        }
      }
    }
  }

  // 3. Check attributes/metadata
  const colorFromAttributes = 
    attributes.color || attributes.Color || 
    attributes.colour || attributes.Colour ||
    metaData.color || metaData.Color ||
    metaData.colour || metaData.Colour;
  
  if (colorFromAttributes) {
    return normalizeColor(colorFromAttributes);
  }

  // 4. Extract from product name
  const colorFromName = detectColorFromText(productName);
  if (colorFromName) return colorFromName;

  // 5. Extract from description (with lower priority)
  const colorFromDescription = detectColorFromText(description, true);
  if (colorFromDescription) return colorFromDescription;

  // 6. Try to extract from HTML content using specific patterns
  if (htmlContent) {
    const colorPatterns = [
      /class="[^"]*color[^"]*"[^>]*>([^<]+)</gi,
      /data-color="([^"]+)"/gi,
      /Color:\s*([^<\n]+)/gi,
      /Colour:\s*([^<\n]+)/gi,
      /<span[^>]*color[^>]*>([^<]+)<\/span>/gi,
    ];

    for (const pattern of colorPatterns) {
      const matches = htmlContent.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const color = detectColorFromText(match[1].trim());
          if (color) return color;
        }
      }
    }
  }

  return null;
}

/**
 * Detect color from text string
 * @param {string} text - Text to search for colors
 * @param {boolean} fuzzy - Use fuzzy matching for descriptions
 * @returns {string|null} - Detected color or null
 */
function detectColorFromText(text, fuzzy = false) {
  if (!text || typeof text !== 'string') return null;
  
  const searchText = text.toLowerCase().trim();
  
  // First check priority colors with word boundaries
  for (const color of priorityColors) {
    const regex = new RegExp(`\\b${color}\\b`, 'i');
    if (regex.test(searchText)) {
      return capitalizeColor(color);
    }
  }
  
  // Then check all color mappings
  for (const [mainColor, variations] of Object.entries(colorMappings)) {
    for (const variation of variations) {
      if (fuzzy) {
        // For descriptions, use more relaxed matching
        if (searchText.includes(variation.toLowerCase())) {
          return capitalizeColor(mainColor);
        }
      } else {
        // For product names and specific fields, use word boundary matching
        const regex = new RegExp(`\\b${variation}\\b`, 'i');
        if (regex.test(searchText)) {
          return capitalizeColor(mainColor);
        }
      }
    }
  }
  
  return null;
}

/**
 * Normalize and clean color string
 * @param {string} color - Raw color string
 * @returns {string} - Normalized color
 */
function normalizeColor(color) {
  if (!color || typeof color !== 'string') return null;
  
  // Clean the color string
  let cleaned = color
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  // Check if it matches any known color
  const detected = detectColorFromText(cleaned);
  if (detected) return detected;
  
  // Otherwise return the cleaned original
  return capitalizeColor(cleaned);
}

/**
 * Capitalize color name properly
 * @param {string} color - Color to capitalize
 * @returns {string} - Capitalized color
 */
function capitalizeColor(color) {
  if (!color) return null;
  
  // Handle multi-word colors
  return color
    .split(/[\s-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract multiple colors if product has color variants
 * @param {Object} data - Product data
 * @returns {Array} - Array of colors
 */
function extractAllColors(data) {
  const colors = new Set();
  
  // Extract from variants
  if (data.variants && Array.isArray(data.variants)) {
    for (const variant of data.variants) {
      const color = extractColor({ ...data, variants: [variant] });
      if (color) colors.add(color);
    }
  }
  
  // Extract from options
  if (data.options && Array.isArray(data.options)) {
    for (const option of data.options) {
      if (option.name && option.name.toLowerCase().includes('color')) {
        if (option.values && Array.isArray(option.values)) {
          option.values.forEach(value => {
            const color = normalizeColor(value);
            if (color) colors.add(color);
          });
        }
      }
    }
  }
  
  // If no variants/options, try to extract single color
  if (colors.size === 0) {
    const singleColor = extractColor(data);
    if (singleColor) colors.add(singleColor);
  }
  
  return Array.from(colors);
}

module.exports = {
  extractColor,
  extractAllColors,
  detectColorFromText,
  normalizeColor,
  colorMappings
};