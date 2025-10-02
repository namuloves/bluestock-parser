const cheerio = require('cheerio');
const FirecrawlApp = require('@mendable/firecrawl-js').default;

/**
 * Firecrawl-based scraper for sites with enterprise-grade bot detection
 * Handles: SSENSE, REI, and other protected sites
 */
class FirecrawlParser {
  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ FIRECRAWL_API_KEY not set - Firecrawl parser will not work');
    }
    this.firecrawl = this.apiKey && FirecrawlApp ? new FirecrawlApp({ apiKey: this.apiKey }) : null;
  }

  /**
   * Parse product data from Firecrawl response
   */
  parseProductData(html, markdown, url) {
    const $ = cheerio.load(html);
    const hostname = new URL(url).hostname.toLowerCase();

    // Site-specific parsers
    if (hostname.includes('ssense.com')) {
      return this.parseSsense($, markdown, url);
    } else if (hostname.includes('rei.com')) {
      return this.parseREI($, markdown, url);
    }

    // Generic parser as fallback
    return this.parseGeneric($, markdown, url);
  }

  /**
   * SSENSE-specific parser
   */
  parseSsense($, markdown, url) {
    const product = {
      platform: 'ssense',
      vendor_url: url
    };

    // Try JSON-LD first
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data['@type'] === 'Product' || data.name) {
          product.product_name = data.name || '';
          product.brand = data.brand?.name || data.brand || '';
          product.description = data.description || '';

          if (data.offers) {
            product.sale_price = parseFloat(data.offers.price) || 0;
            product.original_price = parseFloat(data.offers.price) || 0;
          }

          if (data.image) {
            product.image_urls = Array.isArray(data.image) ? data.image : [data.image];
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    }

    // Fallback to selectors
    if (!product.product_name) {
      product.product_name = $('h1[itemprop="name"]').text().trim() ||
                            $('h1.product-name').text().trim() ||
                            $('h1').first().text().trim();
    }

    if (!product.brand) {
      product.brand = $('[itemprop="brand"]').text().trim() ||
                     $('.brand-name').text().trim() ||
                     $('.designer-name').text().trim();
    }

    if (!product.sale_price) {
      const priceText = $('[itemprop="price"]').attr('content') ||
                       $('.price-amount').first().text().trim() ||
                       $('.product-price').first().text().trim();
      product.sale_price = this.parsePrice(priceText);
      product.original_price = product.sale_price;
    }

    // Extract images
    if (!product.image_urls || product.image_urls.length === 0) {
      const images = [];
      $('img[itemprop="image"], .product-image img, .gallery img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('placeholder') && !src.includes('loading')) {
          images.push(this.normalizeImageUrl(src));
        }
      });
      product.image_urls = [...new Set(images)]; // Remove duplicates
    }

    // Description
    if (!product.description) {
      product.description = $('[itemprop="description"]').text().trim() ||
                           $('.product-description').text().trim() ||
                           $('.description-text').text().trim();
    }

    return product;
  }

  /**
   * REI-specific parser
   */
  parseREI($, markdown, url) {
    const product = {
      platform: 'rei',
      vendor_url: url
    };

    // JSON-LD parsing
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data['@type'] === 'Product') {
          product.product_name = data.name || '';
          product.brand = data.brand?.name || data.brand || '';
          product.description = data.description || '';

          if (data.offers) {
            const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
            product.sale_price = parseFloat(offers.price) || 0;
            product.original_price = parseFloat(offers.price) || 0;

            // Check for sale
            if (offers.priceSpecification) {
              product.original_price = parseFloat(offers.priceSpecification.price) || product.sale_price;
              product.is_on_sale = product.sale_price < product.original_price;
            }
          }

          if (data.image) {
            product.image_urls = Array.isArray(data.image) ? data.image : [data.image];
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    }

    // Fallback selectors for REI
    if (!product.product_name) {
      product.product_name = $('#product-page-title').text().trim() ||
                            $('h1[data-ui="product-name"]').text().trim() ||
                            $('h1').first().text().trim();
    }

    if (!product.brand) {
      product.brand = $('[data-ui="product-brand"]').text().trim() ||
                     $('.brand').text().trim();
    }

    // Prices
    if (!product.sale_price) {
      const salePrice = $('[data-ui="product-price-sale"]').text().trim() ||
                       $('.price-value').first().text().trim();
      const regularPrice = $('[data-ui="product-price-regular"]').text().trim();

      product.sale_price = this.parsePrice(salePrice);
      product.original_price = regularPrice ? this.parsePrice(regularPrice) : product.sale_price;
      product.is_on_sale = product.original_price > product.sale_price;
    }

    // Images
    if (!product.image_urls || product.image_urls.length === 0) {
      const images = [];
      $('.product-image img, [data-ui="product-image"] img, .media-viewer img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-zoom-src');
        if (src && !src.includes('placeholder')) {
          images.push(this.normalizeImageUrl(src));
        }
      });
      product.image_urls = [...new Set(images)];
    }

    return product;
  }

  /**
   * Generic parser using common e-commerce patterns
   */
  parseGeneric($, markdown, url) {
    const product = {
      platform: 'firecrawl-generic',
      vendor_url: url
    };

    // Try JSON-LD - check all script tags
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonLd = $(el).html();
        if (!jsonLd) return;

        const data = JSON.parse(jsonLd);
        const productData = Array.isArray(data)
          ? data.find(item => item['@type'] === 'Product')
          : data['@type'] === 'Product' ? data : null;

        if (productData) {
          product.product_name = productData.name || product.product_name || '';
          product.brand = productData.brand?.name || productData.brand || product.brand || '';
          product.description = productData.description || product.description || '';

          if (productData.offers) {
            const offers = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
            product.sale_price = parseFloat(offers.price) || product.sale_price || 0;
            product.original_price = parseFloat(offers.price) || product.original_price || 0;
          }

          if (productData.image) {
            const images = Array.isArray(productData.image) ? productData.image : [productData.image];
            product.image_urls = images.length > 0 ? images : product.image_urls || [];
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    });

    // Common selectors for product name
    if (!product.product_name) {
      const titleSelectors = [
        'h1',
        '[data-testid="product-name"]',
        '[itemprop="name"]',
        '.product-name',
        '.product-title',
        '[class*="product-title"]',
        '[class*="productName"]'
      ];

      for (const selector of titleSelectors) {
        const title = $(selector).first().text().trim();
        if (title && title.length > 3 && !title.toLowerCase().includes('search')) {
          product.product_name = title;
          break;
        }
      }
    }

    // Try to get from meta tags
    if (!product.product_name) {
      product.product_name = $('meta[property="og:title"]').attr('content') ||
                            $('meta[name="twitter:title"]').attr('content') ||
                            $('title').text().split('|')[0].trim();
    }

    if (!product.brand) {
      product.brand = $('.product-brand, .brand, [itemprop="brand"]').first().text().trim() ||
                     $('meta[property="og:brand"]').attr('content') ||
                     'Unknown';
    }

    // Extract price
    if (!product.sale_price) {
      const priceSelectors = [
        '.price', '.product-price', '[data-price]', '[itemprop="price"]',
        '.final-price', '.current-price'
      ];

      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim() ||
                         $(selector).first().attr('content');
        if (priceText) {
          product.sale_price = this.parsePrice(priceText);
          product.original_price = product.sale_price;
          break;
        }
      }
    }

    // Extract images
    if (!product.image_urls || product.image_urls.length === 0) {
      const images = [];
      $('img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
          const fullSrc = this.normalizeImageUrl(src);
          if (fullSrc.match(/\.(jpg|jpeg|png|webp)/i)) {
            images.push(fullSrc);
          }
        }
      });
      product.image_urls = [...new Set(images)].slice(0, 10); // Max 10 images
    }

    return product;
  }

  /**
   * Parse price from text
   */
  parsePrice(priceText) {
    if (!priceText) return 0;

    // Remove currency symbols and extract number
    const cleaned = priceText.replace(/[^0-9.,]/g, '');
    const price = parseFloat(cleaned.replace(',', ''));

    return isNaN(price) ? 0 : price;
  }

  /**
   * Normalize image URL (make absolute)
   */
  normalizeImageUrl(url) {
    if (!url) return '';

    // Already absolute
    if (url.startsWith('http')) {
      return url;
    }

    // Protocol-relative
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    return url;
  }

  /**
   * Main scraping method using Firecrawl
   */
  async scrape(url, options = {}) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API key not configured');
    }

    console.log('🔥 Using Firecrawl to scrape:', url);

    try {
      // Scrape with Firecrawl - get both HTML and markdown
      const result = await this.firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        timeout: options.timeout || 90000, // 90 seconds default
        waitFor: options.waitFor || 5000    // Wait 5 seconds for JS to load
      });

      console.log('✅ Firecrawl scrape successful');

      // Check if scrape was successful
      if (!result.success) {
        console.log('⚠️ Firecrawl returned unsuccessful result:', result.error || result.warning);
        return {
          success: false,
          error: result.error || result.warning || 'Firecrawl scrape unsuccessful'
        };
      }

      // Parse the HTML
      const product = this.parseProductData(
        result.html || '',
        result.markdown || '',
        url
      );

      // Add metadata
      product.scraped_at = new Date().toISOString();
      product.scraper = 'firecrawl';

      // Validate required fields
      if (!product.product_name || !product.sale_price) {
        console.warn('⚠️ Missing required fields after Firecrawl parse');
        return {
          success: false,
          error: 'Failed to extract required product data',
          partial_data: product
        };
      }

      console.log(`✅ Firecrawl parsed: ${product.product_name} - $${product.sale_price}`);

      return {
        success: true,
        product: product
      };

    } catch (error) {
      console.error('❌ Firecrawl error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FirecrawlParser;
