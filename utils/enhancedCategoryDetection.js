// Enhanced category detection with improved accuracy

const categoryRules = {
  'Clothing': {
    keywords: [
      // Tops
      'shirt', 'blouse', 'top', 'tee', 't-shirt', 'tank', 'cami', 'camisole', 'tube',
      'sweater', 'cardigan', 'pullover', 'jumper', 'knit', 'hoodie', 'sweatshirt',
      'jacket', 'coat', 'blazer', 'vest', 'gilet', 'parka', 'trench', 'windbreaker',
      'bomber', 'puffer', 'anorak', 'raincoat', 'peacoat', 'overcoat',
      
      // Bottoms  
      'pants', 'trousers', 'jeans', 'denim', 'chinos', 'slacks', 'leggings', 'tights',
      'shorts', 'bermuda', 'capri', 'joggers', 'sweatpants', 'track pants',
      'skirt', 'mini', 'midi', 'maxi', 'pencil skirt', 'a-line', 'pleated',
      
      // Dresses & Full body
      'dress', 'gown', 'frock', 'sundress', 'shirtdress', 'wrap dress',
      'jumpsuit', 'romper', 'playsuit', 'overall', 'dungaree', 'catsuit', 'bodysuit',
      
      // Underwear & Sleepwear
      'bra', 'underwear', 'panties', 'briefs', 'boxers', 'lingerie', 'shapewear',
      'pajama', 'nightgown', 'robe', 'kimono', 'caftan', 'sleepwear', 'loungewear',
      
      // Swimwear
      'swimsuit', 'bikini', 'tankini', 'swim', 'bathing suit', 'boardshorts',
      
      // Specific items
      'polo', 'henley', 'tunic', 'poncho', 'cape', 'shawl', 'wrap', 'sarong'
    ],
    priority: 1,
    excludeIfContains: ['shoe', 'sneaker', 'boot', 'sandal', 'bag', 'purse', 'wallet', 'belt', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring', 'earring']
  },
  
  'Shoes': {
    keywords: [
      // General
      'shoe', 'footwear', 'shoes',
      
      // Specific types
      'sneaker', 'trainer', 'runner', 'athletic shoe', 'tennis shoe', 'kicks',
      'boot', 'ankle boot', 'knee high', 'thigh high', 'chelsea', 'combat', 'hiking',
      'work boot', 'rain boot', 'snow boot', 'riding boot', 'cowboy', 'moto',
      'sandal', 'slide', 'flip flop', 'thong', 'gladiator', 'espadrille',
      'heel', 'pump', 'stiletto', 'platform', 'wedge', 'kitten heel', 'block heel',
      'loafer', 'moccasin', 'driver', 'penny loafer', 'tassel loafer',
      'flat', 'ballet flat', 'ballerina', 'slip-on', 'mule', 'clog', 'sabot',
      'oxford', 'brogue', 'derby', 'monk strap', 'wingtip', 'blucher',
      'mary jane', 'slingback', 'd\'orsay', 'peep toe', 'pointed toe'
    ],
    priority: 2,
    brandKeywords: ['nike', 'adidas', 'puma', 'reebok', 'converse', 'vans', 'new balance', 'asics', 'saucony', 'brooks', 'under armour', 'jordan', 'yeezy', 'balenciaga runner']
  },
  
  'Bags': {
    keywords: [
      // General
      'bag', 'purse', 'handbag',
      
      // Specific types
      'tote', 'shopper', 'carryall', 'beach bag',
      'shoulder bag', 'crossbody', 'messenger', 'sling bag',
      'backpack', 'rucksack', 'knapsack', 'daypack',
      'clutch', 'evening bag', 'minaudiere', 'wristlet', 'pouch',
      'satchel', 'doctor bag', 'bowler', 'bucket bag', 'hobo',
      'wallet', 'card holder', 'coin purse', 'money clip', 'billfold',
      'briefcase', 'portfolio', 'laptop bag', 'work bag',
      'duffle', 'weekender', 'travel bag', 'luggage', 'suitcase', 'carry-on',
      'fanny pack', 'belt bag', 'waist bag', 'bum bag',
      'saddle bag', 'chain bag', 'flap bag', 'quilted bag'
    ],
    priority: 3,
    brandKeywords: ['coach', 'michael kors', 'kate spade', 'louis vuitton', 'gucci', 'prada', 'chanel', 'hermes', 'celine', 'fendi', 'bottega', 'balenciaga', 'saint laurent', 'ysl', 'dior', 'givenchy', 'valentino', 'chloe', 'marc jacobs', 'tory burch', 'longchamp']
  },
  
  'Accessories': {
    keywords: [
      // Head & Neck
      'hat', 'cap', 'beanie', 'beret', 'fedora', 'panama', 'bucket hat', 'visor',
      'headband', 'hair tie', 'scrunchie', 'hair clip', 'barrette', 'headwrap', 'turban',
      'scarf', 'bandana', 'neckerchief', 'ascot', 'tie', 'bow tie', 'necktie',
      
      // Waist
      'belt', 'sash', 'cummerbund', 'suspenders', 'braces',
      
      // Eyes
      'sunglasses', 'eyeglasses', 'glasses', 'shades', 'specs', 'frames',
      
      // Hands
      'gloves', 'mittens', 'gauntlets',
      
      // Tech
      'watch', 'smartwatch', 'fitness tracker',
      'phone case', 'airpod case', 'tech accessories',
      
      // Other
      'umbrella', 'parasol', 'keychain', 'key ring', 'lanyard',
      'mask', 'face covering', 'bandana mask'
    ],
    priority: 4,
    excludeIfContains: ['necklace', 'ring', 'bracelet', 'earring', 'jewelry', 'jewellery']
  },
  
  'Jewelry': {
    keywords: [
      // Neck
      'necklace', 'chain', 'pendant', 'choker', 'collar', 'locket', 'medallion',
      
      // Arms & Hands
      'bracelet', 'bangle', 'cuff', 'charm bracelet', 'tennis bracelet', 'anklet',
      'ring', 'band', 'signet', 'cocktail ring', 'engagement ring', 'wedding band',
      
      // Ears
      'earring', 'stud', 'hoop', 'drop', 'dangle', 'chandelier', 'ear cuff', 'huggie',
      
      // Other
      'brooch', 'pin', 'lapel pin', 'body jewelry', 'piercing', 'toe ring', 'nose ring',
      'jewelry set', 'jewellery', 'bijoux', 'bling',
      
      // Materials often indicate jewelry
      'diamond', 'gold', 'silver', 'platinum', 'pearl', 'gemstone', 'crystal',
      'emerald', 'ruby', 'sapphire', 'amethyst', 'opal', 'jade', 'turquoise'
    ],
    priority: 5,
    brandKeywords: ['tiffany', 'cartier', 'pandora', 'swarovski', 'bulgari', 'van cleef', 'harry winston', 'chopard', 'bvlgari', 'david yurman', 'mejuri', 'monica vinader']
  }
};

// Breadcrumb patterns commonly found on e-commerce sites
const breadcrumbPatterns = {
  'Clothing': ['clothing', 'apparel', 'ready-to-wear', 'rtw', 'garments', 'fashion', 'womens-clothing', 'mens-clothing'],
  'Shoes': ['shoes', 'footwear', 'sneakers', 'boots', 'sandals', 'heels', 'flats'],
  'Bags': ['bags', 'handbags', 'purses', 'luggage', 'backpacks', 'wallets'],
  'Accessories': ['accessories', 'acc', 'small-goods', 'small-leather-goods', 'slg'],
  'Jewelry': ['jewelry', 'jewellery', 'fine-jewelry', 'fashion-jewelry', 'bijoux']
};

/**
 * Enhanced category detection with multiple strategies
 * @param {Object} data - Product data
 * @returns {string} - Detected category
 */
function detectCategory(data) {
  const {
    productName = '',
    description = '',
    brand = '',
    scrapedCategory = '',
    breadcrumbs = [],
    url = '',
    metaTags = {},
    structuredData = {}
  } = data;

  // Strategy 1: Check structured data (most reliable)
  if (structuredData && structuredData.category) {
    const matched = matchCategoryFromText(structuredData.category);
    if (matched) return matched;
  }

  // Strategy 2: Check breadcrumbs
  if (breadcrumbs && breadcrumbs.length > 0) {
    const breadcrumbText = breadcrumbs.join(' ').toLowerCase();
    for (const [category, patterns] of Object.entries(breadcrumbPatterns)) {
      if (patterns.some(pattern => breadcrumbText.includes(pattern))) {
        return category;
      }
    }
  }

  // Strategy 3: Check scraped category
  if (scrapedCategory) {
    const matched = matchCategoryFromText(scrapedCategory);
    if (matched) return matched;
  }

  // Strategy 4: Check URL path
  if (url) {
    const urlLower = url.toLowerCase();
    for (const [category, patterns] of Object.entries(breadcrumbPatterns)) {
      if (patterns.some(pattern => urlLower.includes(`/${pattern}/`) || urlLower.includes(`-${pattern}-`))) {
        return category;
      }
    }
  }

  // Strategy 5: Brand-based detection
  const brandLower = brand.toLowerCase();
  for (const [category, rules] of Object.entries(categoryRules)) {
    if (rules.brandKeywords && rules.brandKeywords.some(keyword => brandLower.includes(keyword))) {
      return category;
    }
  }

  // Strategy 6: Keyword matching with priority and exclusions
  const searchText = `${productName} ${description}`.toLowerCase();
  const scores = {};

  for (const [category, rules] of Object.entries(categoryRules)) {
    let score = 0;
    let excluded = false;

    // Check exclusions first
    if (rules.excludeIfContains) {
      excluded = rules.excludeIfContains.some(keyword => 
        productName.toLowerCase().includes(keyword)
      );
    }

    if (!excluded) {
      // Count keyword matches
      for (const keyword of rules.keywords) {
        // Exact word match in product name (higher weight)
        const nameRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (nameRegex.test(productName)) {
          score += 3;
        }
        // Match in description (lower weight)
        else if (searchText.includes(keyword)) {
          score += 1;
        }
      }

      // Apply priority multiplier
      if (score > 0) {
        score *= (6 - rules.priority); // Higher priority = higher multiplier
        scores[category] = score;
      }
    }
  }

  // Return highest scoring category
  if (Object.keys(scores).length > 0) {
    return Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];
  }

  // Strategy 7: Fallback to simple keyword matching
  const fallbackCategory = matchCategoryFromText(searchText);
  if (fallbackCategory) return fallbackCategory;

  return 'Other';
}

/**
 * Match category from text using keyword rules
 * @param {string} text - Text to analyze
 * @returns {string|null} - Matched category or null
 */
function matchCategoryFromText(text) {
  if (!text) return null;
  
  const searchText = text.toLowerCase();
  
  for (const [category, rules] of Object.entries(categoryRules)) {
    // Check if any priority keywords match
    const priorityKeywords = rules.keywords.slice(0, 10); // First 10 are usually most common
    for (const keyword of priorityKeywords) {
      if (searchText.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

/**
 * Get all possible categories for a product (for multi-category items)
 * @param {Object} data - Product data
 * @returns {Array} - Array of possible categories
 */
function detectAllCategories(data) {
  const categories = new Set();
  
  // Run main detection
  const mainCategory = detectCategory(data);
  if (mainCategory !== 'Other') {
    categories.add(mainCategory);
  }
  
  // Check for multi-category items (e.g., "shoe bag", "jewelry box")
  const searchText = `${data.productName} ${data.description}`.toLowerCase();
  
  for (const [category, rules] of Object.entries(categoryRules)) {
    const hasMatch = rules.keywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(searchText);
    });
    
    if (hasMatch && !rules.excludeIfContains?.some(ex => searchText.includes(ex))) {
      categories.add(category);
    }
  }
  
  return Array.from(categories);
}

module.exports = {
  detectCategory,
  detectAllCategories,
  matchCategoryFromText,
  categoryRules
};