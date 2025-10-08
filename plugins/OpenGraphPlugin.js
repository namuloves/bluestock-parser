/**
 * Open Graph Extraction Plugin
 * Extracts product data from Open Graph meta tags
 */
class OpenGraphPlugin {
  constructor() {
    this.name = 'OpenGraphPlugin';
    this.priority = 70; // Lower priority - OG tags are less detailed
  }

  /**
   * Check if this plugin can handle the page
   */
  canHandle($, url) {
    return $('meta[property^="og:"], meta[property^="product:"]').length > 0;
  }

  /**
   * Extract product data from Open Graph tags
   */
  extract($, url) {
    const data = {};
    const errors = [];

    try {
      // Check if it's a product page
      const ogType = $('meta[property="og:type"]').attr('content');
      const isProduct = ogType === 'product' ||
                       ogType === 'product.item' ||
                       $('meta[property^="product:"]').length > 0;

      if (!isProduct && !ogType) {
        // Still try to extract if we have product: tags
        if ($('meta[property^="product:"]').length === 0) {
          return { success: false, data: {}, errors: ['Not a product page (no product OG tags)'] };
        }
      }

      // Title/Name
      const title = this.getMeta($, 'og:title') ||
                   this.getMeta($, 'product:title');
      if (title) {
        data.name = this.cleanTitle(title);
      }

      // Description
      const description = this.getMeta($, 'og:description') ||
                         this.getMeta($, 'product:description');
      if (description) {
        data.description = description;
      }

      // Images
      const images = this.getImages($);
      if (images.length > 0) {
        data.images = images;
      }

      // Price
      const price = this.getMeta($, 'product:price:amount') ||
                   this.getMeta($, 'product:price') ||
                   this.getMeta($, 'og:price:amount');
      if (price) {
        data.price = this.parsePrice(price);
      }

      // Sale Price
      const salePrice = this.getMeta($, 'product:sale_price:amount') ||
                       this.getMeta($, 'product:sale_price');
      if (salePrice) {
        data.sale_price = this.parsePrice(salePrice);
      }

      // Currency
      const currency = this.getMeta($, 'product:price:currency') ||
                      this.getMeta($, 'og:price:currency') ||
                      this.getMeta($, 'product:currency');
      if (currency) {
        data.currency = currency;
      }

      // Brand
      const brand = this.getMeta($, 'product:brand') ||
                   this.getMeta($, 'og:brand');
      if (brand) {
        data.brand = brand;
      }

      // Availability
      const availability = this.getMeta($, 'product:availability') ||
                          this.getMeta($, 'og:availability');
      if (availability) {
        data.availability = this.parseAvailability(availability);
      }

      // Category
      const category = this.getMeta($, 'product:category') ||
                      this.getMeta($, 'og:category');
      if (category) {
        data.category = category;
      }

      // Product ID/SKU
      const productId = this.getMeta($, 'product:id') ||
                       this.getMeta($, 'product:sku') ||
                       this.getMeta($, 'og:product:id');
      if (productId) {
        data.sku = productId;
      }

      // Retailer
      const retailer = this.getMeta($, 'product:retailer') ||
                      this.getMeta($, 'og:site_name');
      if (retailer && !data.brand) {
        // Sometimes retailer is actually the brand
        data.retailer = retailer;
      }

      // URL
      const productUrl = this.getMeta($, 'og:url');
      if (productUrl) {
        data.url = productUrl;
      }

      // Rating (rare in OG tags)
      const rating = this.getMeta($, 'product:rating');
      const ratingScale = this.getMeta($, 'product:rating_scale');
      const ratingCount = this.getMeta($, 'product:rating_count');

      if (rating) {
        data.rating = {
          value: parseFloat(rating),
          scale: ratingScale ? parseFloat(ratingScale) : 5,
          count: ratingCount ? parseInt(ratingCount) : 0
        };
      }

    } catch (error) {
      errors.push(`Open Graph extraction error: ${error.message}`);
    }

    return {
      success: Object.keys(data).length > 0,
      data,
      errors
    };
  }

  /**
   * Get meta tag content
   */
  getMeta($, property) {
    const meta = $(`meta[property="${property}"]`).attr('content') ||
                $(`meta[name="${property}"]`).attr('content');
    return meta ? meta.trim() : null;
  }

  /**
   * Get all product images
   */
  getImages($) {
    const images = [];

    // Primary image
    const primaryImage = this.getMeta($, 'og:image') ||
                        this.getMeta($, 'product:image');
    if (primaryImage) {
      images.push(primaryImage);
    }

    // Additional images
    $('meta[property^="og:image:"], meta[property^="product:image:"]').each((i, elem) => {
      const content = $(elem).attr('content');
      const property = $(elem).attr('property');

      // Skip image metadata (width, height, type)
      if (property && !property.includes('width') &&
          !property.includes('height') &&
          !property.includes('type') &&
          !property.includes('alt')) {
        if (content && !images.includes(content)) {
          images.push(content);
        }
      }
    });

    // Twitter images as fallback
    if (images.length === 0) {
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      if (twitterImage) {
        images.push(twitterImage);
      }
    }

    return images;
  }

  /**
   * Parse price value
   */
  parsePrice(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value);
    // Remove currency symbols and extract number
    const match = str.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /**
   * Parse availability status
   */
  parseAvailability(value) {
    if (!value) return null;

    const normalized = value.toLowerCase();

    if (normalized.includes('in stock') || normalized === 'instock' || normalized === 'available') {
      return 'in_stock';
    }
    if (normalized.includes('out of stock') || normalized === 'outofstock' || normalized === 'oos') {
      return 'out_of_stock';
    }
    if (normalized.includes('preorder') || normalized.includes('pre-order')) {
      return 'preorder';
    }
    if (normalized.includes('limited')) {
      return 'limited';
    }
    if (normalized.includes('discontinued')) {
      return 'discontinued';
    }

    // Default to in stock if we can't determine
    return 'in_stock';
  }

  /**
   * Clean title/name
   * Remove common suffixes and clean up
   */
  cleanTitle(title) {
    if (!title) return '';

    return title
      // Remove site name suffixes
      .replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '')
      // Remove "Buy" prefixes
      .replace(/^(Buy|Shop|Get)\s+/i, '')
      // Clean whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = OpenGraphPlugin;