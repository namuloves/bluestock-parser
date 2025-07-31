// Ralph Lauren selector configuration
// This file contains selectors that can be easily updated if Ralph Lauren changes their HTML structure

const ralphLaurenSelectors = {
  // Image container selectors - ordered by priority
  imageContainers: [
    '.ghosting-main',              // Current main image container
    '.product-images-main',        // Alternative main container
    '.product-gallery',            // Gallery container
    '[class*="product-image"]',    // Any class containing "product-image"
    '[class*="gallery"]',          // Any class containing "gallery"
    '.pdp-image-container',        // Product detail page images
    '.product-media'               // Media container
  ],
  
  // Image selectors within containers
  imageSelectors: [
    'img[src*="scene7.com"]:not([src*="swatch"])',
    'img[src*="lifestyle"]',
    'img[src*="main"]',
    'img[src*="detail"]',
    'img[alt*="lifestyle"]',
    'img[alt*="main"]',
    'img[data-src*="scene7.com"]:not([data-src*="swatch"])'
  ],
  
  // Price selectors
  priceSelectors: [
    '.product-price',
    '[class*="price"]:not([class*="strike"]):not([class*="was"])',
    '[class*="Price"]:not([class*="Original"])',
    'span[itemprop="price"]',
    '[data-testid="product-price"]',
    '.price-sales'
  ],
  
  // Exclusion patterns for images
  imageExclusions: [
    'swatch',
    'logo',
    'icon',
    '$rl_df_40_swatch$',
    'badge',
    'flag'
  ],
  
  // Image quality parameters
  imageQuality: {
    // Replace low-res parameters with high-res
    replacements: [
      { from: /\$rl_[^$]+\$/, to: '$rl_df_zoom$' },
      { from: /\?.*$/, to: '?$rl_df_zoom$' },
      { from: '_thumbnail', to: '_zoom' },
      { from: '_small', to: '_large' }
    ]
  }
};

module.exports = ralphLaurenSelectors;