// Category detection utility for product categorization

const categoryKeywords = {
  'Clothing': ['shirt', 'dress', 'jacket', 'coat', 'sweater', 'blouse', 'top', 'pants', 'jeans', 'skirt', 'suit', 'hoodie', 'cardigan', 'vest', 'shorts', 'leggings', 'romper', 'jumpsuit', 'blazer', 'denim', 'tee', 't-shirt', 'tank', 'crop', 'tunic', 'pant', 'trouser', 'chino', 'jogger', 'sweatshirt', 'sweatpant', 'polo', 'henley', 'thermal', 'pajama', 'robe', 'kimono', 'caftan', 'poncho', 'cape', 'shawl', 'wrap'],
  'Shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'flat', 'pump', 'slipper', 'oxford', 'mule', 'wedge', 'espadrille', 'clog', 'platform', 'stiletto', 'ankle boot', 'knee high', 'thigh high', 'chelsea', 'combat', 'hiking', 'running', 'trainer', 'slip-on', 'mary jane', 'ballerina', 'mocassin'],
  'Bags': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'wallet', 'satchel', 'crossbody', 'messenger', 'pouch', 'handbag', 'hobo', 'bucket', 'shoulder bag', 'duffle', 'weekender', 'briefcase', 'wristlet', 'card holder', 'coin purse', 'fanny pack', 'belt bag', 'saddle bag', 'shopper', 'carryall'],
  'Accessories': ['belt', 'scarf', 'hat', 'cap', 'gloves', 'sunglasses', 'watch', 'tie', 'beanie', 'headband', 'bandana', 'visor', 'beret', 'fedora', 'panama', 'bucket hat', 'baseball cap', 'mittens', 'earmuffs', 'umbrella', 'keychain', 'hair clip', 'hair tie', 'scrunchie', 'headwrap', 'turban'],
  'Jewelry': ['necklace', 'ring', 'bracelet', 'earring', 'pendant', 'chain', 'brooch', 'anklet', 'charm', 'jewel', 'diamond', 'gold', 'silver', 'pearl', 'gemstone', 'stud', 'hoop', 'drop earring', 'choker', 'locket', 'cuff', 'bangle', 'beads', 'jewelry set', 'body jewelry', 'toe ring', 'nose ring', 'piercing']
};

const priorityRules = {
  'Clothing': ['dress', 'shirt', 'jacket', 'coat', 'sweater', 'blouse', 'top', 'pants', 'jeans', 'skirt', 'suit', 'hoodie', 'blazer'],
  'Shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'flat', 'pump'],
  'Bags': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'wallet', 'handbag'],
  'Jewelry': ['necklace', 'ring', 'bracelet', 'earring', 'pendant', 'chain']
};

const brandMappings = {
  'nike': 'Shoes',
  'adidas': 'Shoes',
  'puma': 'Shoes',
  'reebok': 'Shoes',
  'converse': 'Shoes',
  'vans': 'Shoes',
  'new balance': 'Shoes',
  'asics': 'Shoes',
  'saucony': 'Shoes',
  'under armour': 'Shoes',
  'coach': 'Bags',
  'michael kors': 'Bags',
  'kate spade': 'Bags',
  'louis vuitton': 'Bags',
  'gucci': 'Bags',
  'prada': 'Bags',
  'chanel': 'Bags',
  'hermes': 'Bags',
  'celine': 'Bags',
  'fendi': 'Bags',
  'tiffany': 'Jewelry',
  'cartier': 'Jewelry',
  'pandora': 'Jewelry',
  'swarovski': 'Jewelry',
  'bulgari': 'Jewelry',
  'van cleef': 'Jewelry'
};

function detectCategory(productName, description, brand, scrapedCategory) {
  // 1. First check if scraped category matches our categories
  if (scrapedCategory) {
    const normalizedScraped = scrapedCategory.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (normalizedScraped.includes(category.toLowerCase()) || 
          keywords.some(keyword => normalizedScraped.includes(keyword))) {
        return category;
      }
    }
  }

  // 2. Priority rules - certain keywords should immediately determine category
  const searchText = `${productName} ${description}`.toLowerCase();
  
  // Check priority rules first
  for (const [category, keywords] of Object.entries(priorityRules)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  // 3. Check product name and description for keywords (fallback scoring)
  const categoryScores = {};

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // Give more weight to matches in product name
        score += productName.toLowerCase().includes(keyword.toLowerCase()) ? 2 : 1;
      }
    }
    if (score > 0) {
      categoryScores[category] = score;
    }
  }

  // 4. Check brand-specific mappings
  const brandLower = brand.toLowerCase();
  for (const [brandKey, category] of Object.entries(brandMappings)) {
    if (brandLower.includes(brandKey)) {
      // Add weight to brand-suggested category
      categoryScores[category] = (categoryScores[category] || 0) + 1.5;
    }
  }

  // 5. Return highest scoring category or 'Other'
  if (Object.keys(categoryScores).length > 0) {
    return Object.entries(categoryScores).reduce((a, b) => 
      categoryScores[a[0]] > categoryScores[b[0]] ? a : b
    )[0];
  }

  return 'Other'; // Fallback
}

module.exports = { detectCategory };