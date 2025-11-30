/**
 * JSON-LD Extraction Plugin
 * Extracts product data from structured data (application/ld+json)
 */
class JsonLdPlugin {
  constructor() {
    this.name = 'JsonLdPlugin';
    this.priority = 90; // High priority - structured data is reliable
  }

  /**
   * Check if this plugin can handle the page
   */
  canHandle($, url) {
    return $('script[type="application/ld+json"]').length > 0;
  }

  /**
   * Extract product data from JSON-LD
   */
  extract($, url) {
    const data = {};
    const errors = [];

    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const jsonText = $(elem).html();
        if (!jsonText) return;

        const json = JSON.parse(jsonText);

        // Handle direct Product type
        if (json['@type'] === 'Product') {
          this.extractProduct(json, data);
        }

        // Handle Product in @graph
        if (json['@graph']) {
          const products = json['@graph'].filter(item => item['@type'] === 'Product');
          if (products.length > 0) {
            this.extractProduct(products[0], data);
          }
        }

        // Handle Product as mainEntity
        if (json.mainEntity && json.mainEntity['@type'] === 'Product') {
          this.extractProduct(json.mainEntity, data);
        }

        // Handle array of items
        if (Array.isArray(json)) {
          const product = json.find(item => item['@type'] === 'Product');
          if (product) {
            this.extractProduct(product, data);
          }
        }

      } catch (error) {
        errors.push(`JSON-LD parse error: ${error.message}`);
      }
    });

    return {
      success: Object.keys(data).length > 0,
      data,
      errors
    };
  }

  /**
   * Extract product fields from JSON-LD object
   */
  extractProduct(product, data) {
    // Name
    if (product.name && !data.name) {
      data.name = this.cleanText(product.name);
    }

    // Brand
    if (product.brand) {
      if (typeof product.brand === 'object') {
        data.brand = product.brand.name || product.brand['@id'];
      } else {
        data.brand = product.brand;
      }
    }

    // Price
    if (product.offers) {
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;

      if (offers.price) {
        data.price = this.parsePrice(offers.price);
        // Store original price with currency for reference
        data.price_raw = offers.price;
      }

      if (offers.lowPrice) {
        data.price = this.parsePrice(offers.lowPrice);
        data.price_raw = offers.lowPrice;
      }

      if (offers.priceCurrency) {
        data.currency = offers.priceCurrency;
        // Mark this as JSON-LD sourced currency (might not match displayed price)
        data.currency_source = 'jsonld';
      }

      if (offers.availability) {
        data.availability = this.parseAvailability(offers.availability);
      }

      // Handle sale price
      if (offers.priceSpecification) {
        const specs = Array.isArray(offers.priceSpecification)
          ? offers.priceSpecification
          : [offers.priceSpecification];

        for (const spec of specs) {
          if (spec['@type'] === 'SalePrice' || spec.name === 'Sale Price') {
            data.sale_price = this.parsePrice(spec.price);
          }
        }
      }
    }

    // Images
    if (product.image) {
      data.images = this.parseImages(product.image);
    }

    // Description
    if (product.description) {
      data.description = this.cleanText(product.description);
    }

    // SKU
    if (product.sku) {
      data.sku = product.sku;
    }

    // GTIN/EAN
    if (product.gtin || product.gtin13 || product.gtin8) {
      data.gtin = product.gtin || product.gtin13 || product.gtin8;
    }

    // Category
    if (product.category) {
      data.category = product.category;
    }

    // Rating
    if (product.aggregateRating) {
      data.rating = {
        value: parseFloat(product.aggregateRating.ratingValue),
        count: parseInt(product.aggregateRating.reviewCount || product.aggregateRating.ratingCount)
      };
    }
  }

  /**
   * Parse price value
   */
  parsePrice(value) {
    if (typeof value === 'number') return value;
    if (!value) return null;

    const str = String(value);
    const match = str.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /**
   * Parse images into array
   */
  parseImages(images) {
    if (!images) return [];

    if (typeof images === 'string') {
      return [images];
    }

    if (Array.isArray(images)) {
      return images.map(img => {
        if (typeof img === 'string') return img;
        if (img.url) return img.url;
        if (img.contentUrl) return img.contentUrl;
        return null;
      }).filter(Boolean);
    }

    if (images.url) return [images.url];
    if (images.contentUrl) return [images.contentUrl];

    return [];
  }

  /**
   * Parse availability status
   */
  parseAvailability(availability) {
    const value = String(availability).toLowerCase();

    if (value.includes('instock') || value.includes('in stock')) {
      return 'in_stock';
    }
    if (value.includes('outofstock') || value.includes('out of stock')) {
      return 'out_of_stock';
    }
    if (value.includes('preorder')) {
      return 'preorder';
    }
    if (value.includes('limited')) {
      return 'limited';
    }

    return 'in_stock'; // Default
  }

  /**
   * Clean text content
   */
  cleanText(text) {
    if (!text) return '';
    return String(text)
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }
}

module.exports = JsonLdPlugin;