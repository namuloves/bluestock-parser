/**
 * Microdata Extraction Plugin
 * Extracts product data from HTML microdata (itemscope, itemprop)
 */
class MicrodataPlugin {
  constructor() {
    this.name = 'MicrodataPlugin';
    this.priority = 80; // Good priority - microdata is reliable
  }

  /**
   * Check if this plugin can handle the page
   */
  canHandle($, url) {
    return $('[itemtype*="schema.org/Product"]').length > 0 ||
           $('[itemtype*="Product"]').length > 0;
  }

  /**
   * Extract product data from microdata
   */
  extract($, url) {
    const data = {};
    const errors = [];

    try {
      // Find product scope
      const productScope = $('[itemtype*="Product"]').first();

      if (productScope.length === 0) {
        return { success: false, data: {}, errors: ['No product microdata found'] };
      }

      // Extract within product scope
      const scope = productScope;

      // Name
      const name = this.getItemprop(scope, 'name', $);
      if (name) data.name = name;

      // Brand
      const brand = this.getItemprop(scope, 'brand', $);
      if (brand) data.brand = brand;

      // Description
      const description = this.getItemprop(scope, 'description', $);
      if (description) data.description = description;

      // Images
      const images = this.getImages(scope, $);
      if (images.length > 0) data.images = images;

      // SKU
      const sku = this.getItemprop(scope, 'sku', $);
      if (sku) data.sku = sku;

      // Price and offers
      const offers = scope.find('[itemtype*="Offer"]').first();
      if (offers.length > 0) {
        // Price
        const price = this.getPrice(offers, $);
        if (price) data.price = price;

        // Currency
        const currency = this.getItemprop(offers, 'priceCurrency', $);
        if (currency) data.currency = currency;

        // Availability
        const availability = this.getAvailability(offers, $);
        if (availability) data.availability = availability;
      } else {
        // Try to find price outside of offer scope
        const price = this.getPrice(scope, $);
        if (price) data.price = price;
      }

      // Rating
      const rating = this.getRating(scope, $);
      if (rating) data.rating = rating;

      // Category
      const category = this.getItemprop(scope, 'category', $);
      if (category) data.category = category;

    } catch (error) {
      errors.push(`Microdata extraction error: ${error.message}`);
    }

    return {
      success: Object.keys(data).length > 0,
      data,
      errors
    };
  }

  /**
   * Get itemprop value
   */
  getItemprop(scope, prop, $) {
    const element = scope.find(`[itemprop="${prop}"]`).first();

    if (element.length === 0) {
      // Try global search as fallback
      const global = $(`[itemprop="${prop}"]`).first();
      return global.length > 0 ? this.extractValue(global, $) : null;
    }

    return this.extractValue(element, $);
  }

  /**
   * Extract value from element
   */
  extractValue(element, $) {
    // Check for content attribute
    const content = element.attr('content');
    if (content) return content.trim();

    // Check for value attribute (for input elements)
    const value = element.attr('value');
    if (value) return value.trim();

    // Check for href (for links)
    const href = element.attr('href');
    if (href && element.prop('tagName') === 'A') return href;

    // Check for src (for images)
    const src = element.attr('src');
    if (src && element.prop('tagName') === 'IMG') return src;

    // Get text content
    const text = element.text().trim();
    return text || null;
  }

  /**
   * Get all images
   */
  getImages(scope, $) {
    const images = [];

    // Find all image itemprops
    scope.find('[itemprop="image"]').each((i, elem) => {
      const element = $(elem);

      if (element.prop('tagName') === 'IMG') {
        const src = element.attr('src');
        if (src && this.isValidImageUrl(src)) images.push(src);
      } else {
        const content = element.attr('content');
        const href = element.attr('href');
        if (content && this.isValidImageUrl(content)) images.push(content);
        else if (href && this.isValidImageUrl(href)) images.push(href);
      }
    });

    // Also check global scope if no images found
    if (images.length === 0) {
      $('[itemprop="image"]').each((i, elem) => {
        const element = $(elem);
        if (element.prop('tagName') === 'IMG') {
          const src = element.attr('src');
          if (src && this.isValidImageUrl(src) && images.length < 5) images.push(src);
        }
      });
    }

    return images;
  }

  /**
   * Check if URL is a valid image URL
   */
  isValidImageUrl(url) {
    if (!url) return false;

    // Filter out payment/contact metadata URLs
    const invalidPatterns = [
      'supports3DS',
      'postalAddress',
      'email',
      'phone',
      'visa',
      'masterCard',
      'mastercard',
      'amex',
      'paypal',
      'discover',
      'javascript:',
      'mailto:',
      'tel:',
      '/paymentAccepted',
      '/ContactPoint'
    ];

    const urlLower = url.toLowerCase();
    if (invalidPatterns.some(pattern => urlLower.includes(pattern.toLowerCase()))) {
      return false;
    }

    // Accept URLs that look like images
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
    const hasImagePath = /\/images?\//i.test(url) || /\/media\//i.test(url) || /\/cdn\//i.test(url);
    const isHttpUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');

    // Accept if it has image extension or looks like an image path
    return hasImageExtension || hasImagePath || isHttpUrl;
  }

  /**
   * Get price value
   */
  getPrice(scope, $) {
    // Try different price itemprops
    const priceProps = ['price', 'lowPrice', 'highPrice', 'offerPrice'];

    for (const prop of priceProps) {
      const priceElem = scope.find(`[itemprop="${prop}"]`).first();

      if (priceElem.length > 0) {
        const value = this.extractValue(priceElem, $);
        const price = this.parsePrice(value);
        if (price) return price;
      }
    }

    return null;
  }

  /**
   * Parse price from string
   */
  parsePrice(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value);
    const match = str.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /**
   * Get availability
   */
  getAvailability(scope, $) {
    const availability = this.getItemprop(scope, 'availability', $);
    if (!availability) return null;

    const value = availability.toLowerCase();

    if (value.includes('instock') || value.includes('in stock')) {
      return 'in_stock';
    }
    if (value.includes('outofstock') || value.includes('out of stock')) {
      return 'out_of_stock';
    }
    if (value.includes('preorder')) {
      return 'preorder';
    }

    // Check link href for schema.org availability
    const linkElem = scope.find('[itemprop="availability"]').first();
    if (linkElem.attr('href')) {
      const href = linkElem.attr('href').toLowerCase();
      if (href.includes('instock')) return 'in_stock';
      if (href.includes('outofstock')) return 'out_of_stock';
      if (href.includes('preorder')) return 'preorder';
    }

    return 'in_stock'; // Default
  }

  /**
   * Get rating information
   */
  getRating(scope, $) {
    const ratingScope = scope.find('[itemtype*="AggregateRating"]').first();

    if (ratingScope.length === 0) {
      return null;
    }

    const ratingValue = this.getItemprop(ratingScope, 'ratingValue', $);
    const reviewCount = this.getItemprop(ratingScope, 'reviewCount', $) ||
                       this.getItemprop(ratingScope, 'ratingCount', $);

    if (ratingValue) {
      return {
        value: parseFloat(ratingValue),
        count: reviewCount ? parseInt(reviewCount) : 0
      };
    }

    return null;
  }
}

module.exports = MicrodataPlugin;