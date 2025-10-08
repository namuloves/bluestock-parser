/**
 * Generic Extraction Plugin
 * Fallback extractor that uses common patterns to find product data
 * Should work on most e-commerce sites without specific configuration
 */

class GenericExtractor {
  constructor() {
    this.name = 'GenericExtractor';
    this.priority = 50; // Lower priority - used as fallback
  }

  /**
   * This plugin can handle any page
   */
  canHandle($, url) {
    return true;
  }

  /**
   * Extract product data using generic patterns
   */
  extract($, url) {
    const data = {};

    // Extract name - try multiple common patterns
    data.name = this.extractName($);

    // Extract price - be aggressive in finding it
    data.price = this.extractPrice($);

    // Extract images - find all product images
    data.images = this.extractImages($, url);

    // Extract brand
    data.brand = this.extractBrand($);

    // Extract description
    data.description = this.extractDescription($);

    // Extract any structured data we can find
    this.extractFromScripts($, data);

    return {
      success: Object.keys(data).length > 0,
      data
    };
  }

  /**
   * Extract product name using multiple strategies
   */
  extractName($) {
    // Strategy 1: Common heading patterns
    const headingSelectors = [
      'h1.product-title', 'h1.product-name', 'h1.product__title',
      '.product-title h1', '.product-name h1',
      'h1[itemprop="name"]', '[data-test="product-name"]',
      '.pdp-name', '.product-info h1', '.product-header h1',
      'h1' // Last resort - just use first h1
    ];

    for (const selector of headingSelectors) {
      const text = $(selector).first().text()?.trim();
      if (text && text.length > 3 && text.length < 200) {
        return text;
      }
    }

    // Strategy 2: Meta tags
    const metaTitle = $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="twitter:title"]').attr('content');

    if (metaTitle) {
      // Clean up meta title (remove site name, etc.)
      return metaTitle.replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '').trim();
    }

    // Strategy 3: Page title
    const pageTitle = $('title').text();
    if (pageTitle) {
      return pageTitle.replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '').trim();
    }

    return null;
  }

  /**
   * Extract price aggressively
   */
  extractPrice($) {
    // First check add to cart button - often has the real selected variant price!
    const addToCartButton = $('button[name="add"], button.add-to-cart, .add-to-cart button');
    if (addToCartButton.length > 0) {
      const buttonText = addToCartButton.text();
      const priceInButton = this.parsePrice(buttonText);
      if (priceInButton > 0) {
        return priceInButton;
      }
    }

    // Look for price in multiple places
    const pricePatterns = [
      // Common price selectors
      '.price', '.product-price', '.current-price', '.sale-price',
      '.price-now', '.price-current', '.product-price-value',
      '[data-price]', '[data-product-price]', '.money',
      '.price--on-sale', '.price-item--sale',

      // Specific patterns
      'span[itemprop="price"]', 'meta[itemprop="price"]',
      '.product-price .money', '.price .money',

      // More generic
      '[class*="price"]:not([class*="compare"])',
      'span:contains("$")', 'span:contains("€")', 'span:contains("£")',

      // Shopify specific
      '.product__price', '.price__regular', '.price-item--regular'
    ];

    for (const selector of pricePatterns) {
      const element = $(selector);

      if (element.length > 0) {
        // Try different ways to get the price
        const price = this.parsePriceFromElement(element, $);
        if (price > 0) {
          return price;
        }
      }
    }

    // Look in meta tags
    const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                     $('meta[property="og:price:amount"]').attr('content');

    if (metaPrice) {
      const parsed = this.parsePrice(metaPrice);
      if (parsed > 0) return parsed;
    }

    // Search all text for price patterns
    const priceRegex = /[\$£€]\s*(\d+(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g;
    const bodyText = $('body').text();
    const matches = [...bodyText.matchAll(priceRegex)];

    if (matches.length > 0) {
      // Return the first reasonable price found
      for (const match of matches) {
        const price = this.parsePrice(match[1]);
        if (price > 0 && price < 100000) {
          return price;
        }
      }
    }

    return null;
  }

  /**
   * Parse price from element
   */
  parsePriceFromElement(element, $) {
    // Try content attribute
    const content = element.attr('content');
    if (content) {
      const parsed = this.parsePrice(content);
      if (parsed > 0) return parsed;
    }

    // Try data attributes
    const dataPrice = element.attr('data-price') ||
                     element.attr('data-product-price');
    if (dataPrice) {
      const parsed = this.parsePrice(dataPrice);
      if (parsed > 0) return parsed;
    }

    // Try text content
    const text = element.text();
    if (text) {
      const parsed = this.parsePrice(text);
      if (parsed > 0) return parsed;
    }

    // Try finding price in child elements
    element.find('span, strong, b').each((i, el) => {
      const childText = $(el).text();
      const parsed = this.parsePrice(childText);
      if (parsed > 0) {
        return parsed;
      }
    });

    return null;
  }

  /**
   * Parse price from string
   */
  parsePrice(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value);

    // Remove currency symbols and spaces
    const cleaned = str.replace(/[$£€¥₹]/g, '')
                      .replace(/\s/g, '')
                      .replace(/,/g, '');

    // Extract number
    const match = cleaned.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : null;
  }

  /**
   * Extract all product images
   */
  extractImages($, url) {
    const images = new Set();

    // Common image selectors
    const imageSelectors = [
      '.product-image img', '.product-photo img', '.product-gallery img',
      '.product__media img', '.product-single__photo img',
      '[data-role="product-image"] img', '.pdp-image img',
      '.gallery img', '.slider img', '.carousel img',
      'picture img', '[itemprop="image"]'
    ];

    for (const selector of imageSelectors) {
      $(selector).each((i, elem) => {
        const src = $(elem).attr('src') ||
                   $(elem).attr('data-src') ||
                   $(elem).attr('data-lazy-src');

        if (src && this.isProductImage(src)) {
          images.add(this.resolveUrl(src, url));
        }
      });
    }

    // Also check meta tags
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      images.add(this.resolveUrl(ogImage, url));
    }

    // Check for Shopify-style image JSON
    $('script').each((i, elem) => {
      const text = $(elem).html();
      if (text && text.includes('product') && text.includes('images')) {
        const imageMatches = text.match(/"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp|gif)[^"]*)"/gi);
        if (imageMatches) {
          imageMatches.forEach(match => {
            const url = match.replace(/"/g, '');
            if (this.isProductImage(url)) {
              images.add(url);
            }
          });
        }
      }
    });

    return Array.from(images).slice(0, 10); // Limit to 10 images
  }

  /**
   * Check if URL is likely a product image
   */
  isProductImage(url) {
    if (!url) return false;

    // Skip common non-product images
    const skipPatterns = [
      'logo', 'icon', 'banner', 'header', 'footer',
      'payment', 'shipping', 'social', 'arrow',
      'cart', 'search', 'user', 'account'
    ];

    const urlLower = url.toLowerCase();
    return !skipPatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Resolve relative URLs
   */
  resolveUrl(img, baseUrl) {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    if (img.startsWith('//')) return 'https:' + img;

    try {
      const url = new URL(baseUrl);
      if (img.startsWith('/')) {
        return url.origin + img;
      }
      return new URL(img, baseUrl).href;
    } catch {
      return img;
    }
  }

  /**
   * Extract brand
   */
  extractBrand($) {
    const brandSelectors = [
      '.brand', '.product-brand', '[itemprop="brand"]',
      '.vendor', '.product-vendor', '[data-brand]',
      '.manufacturer', '.designer'
    ];

    for (const selector of brandSelectors) {
      const text = $(selector).first().text()?.trim();
      if (text && text.length > 1 && text.length < 50) {
        return text;
      }
    }

    return null;
  }

  /**
   * Extract description
   */
  extractDescription($) {
    const descSelectors = [
      '.product-description', '[itemprop="description"]',
      '.product-details', '.description',
      '.product-info-description', '.pdp-description'
    ];

    for (const selector of descSelectors) {
      const text = $(selector).first().text()?.trim();
      if (text && text.length > 10) {
        return text.substring(0, 1000); // Limit length
      }
    }

    return null;
  }

  /**
   * Extract from script tags (Shopify, JSON-LD, etc.)
   */
  extractFromScripts($, data) {
    $('script').each((i, elem) => {
      const text = $(elem).html();
      if (!text) return;

      // Look for product JSON
      if (text.includes('product') || text.includes('Product')) {
        try {
          // Try to find JSON objects in the script
          const jsonMatches = text.match(/\{[^{}]*"(product|Product)"[^{}]*\}/g);
          if (jsonMatches) {
            for (const match of jsonMatches) {
              try {
                const obj = JSON.parse(match);

                // Extract any useful data
                if (!data.name && obj.title) data.name = obj.title;
                if (!data.price && obj.price) data.price = this.parsePrice(obj.price);
                if (!data.brand && obj.vendor) data.brand = obj.vendor;

              } catch (e) {
                // Invalid JSON, skip
              }
            }
          }
        } catch (e) {
          // Error parsing, skip
        }
      }
    });
  }
}

module.exports = GenericExtractor;