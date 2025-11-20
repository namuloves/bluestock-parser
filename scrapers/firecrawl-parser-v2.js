const FirecrawlApp = require('@mendable/firecrawl-js').default;
const z = require('zod');

/**
 * Enhanced Firecrawl Parser V2
 *
 * IMPROVEMENTS:
 * 1. Uses Firecrawl's native extraction capabilities (no manual HTML parsing)
 * 2. Schema-based structured extraction for consistency
 * 3. Actions for dynamic content handling
 * 4. Smarter caching and concurrency
 * 5. Better error handling and retries
 */
class FirecrawlParserV2 {
  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ FIRECRAWL_API_KEY not set - Firecrawl parser will not work');
      this.firecrawl = null;
      return;
    }

    this.firecrawl = new FirecrawlApp({
      apiKey: this.apiKey,
      apiUrl: process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev'
    });

    // Cache for recent scrapes (TTL: 5 minutes)
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Define the product schema for structured extraction
    this.productSchema = z.object({
      name: z.string().describe("Product name or title"),
      brand: z.string().describe("Brand or manufacturer name"),
      price: z.number().describe("Current selling price as a number"),
      originalPrice: z.number().optional().describe("Original price before discount"),
      currency: z.string().default("USD").describe("Currency code"),
      description: z.string().optional().describe("Product description"),
      images: z.array(z.string()).describe("CRITICAL: Extract ALL product image URLs from the image gallery/carousel. Most products have 4-8 images showing different angles, details, and views. Look for thumbnail navigation, image carousel, or multiple product images. Include every unique image URL you can find for this product."),
      inStock: z.boolean().default(true).describe("Whether product is in stock"),
      sku: z.string().optional().describe("Product SKU or identifier"),
      color: z.string().optional().describe("Product color"),
      size: z.string().optional().describe("Product size"),
      sizes: z.array(z.string()).optional().describe("Available sizes"),
      material: z.string().optional().describe("Product material"),
      category: z.string().optional().describe("Product category")
    });
  }

  /**
   * Check cache for recent scrapes
   */
  getCached(url) {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('📦 Using cached result for:', url);
      return cached.data;
    }
    return null;
  }

  /**
   * Save to cache
   */
  setCache(url, data) {
    this.cache.set(url, {
      timestamp: Date.now(),
      data
    });

    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Main scraping method using Firecrawl's advanced features
   * Includes automatic retry logic for timeout failures
   */
  async scrape(url, options = {}) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API key not configured');
    }

    // Track metrics
    const startTime = Date.now();
    let metrics = null;
    try {
      const { getFirecrawlMetrics } = require('../services/firecrawl-metrics');
      metrics = getFirecrawlMetrics();
    } catch (e) {
      // Metrics service not available
    }

    // Check cache first
    const cached = this.getCached(url);
    if (cached && !options.forceRefresh) {
      if (metrics) {
        cached.fromCache = true;
        metrics.recordAttempt('v2', url, startTime, cached);
      }
      return cached;
    }

    // Retry configuration for high-protection sites
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1; // Default: retry once
    const currentRetry = options.currentRetry || 0;

    console.log('🔥 Firecrawl V2 scraping:', url, currentRetry > 0 ? `(Retry ${currentRetry}/${maxRetries})` : '');

    try {
      // Determine site-specific configuration
      const siteConfig = this.getSiteConfig(url);

      // Build extraction prompt based on site
      const extractionPrompt = this.buildExtractionPrompt(url);

      // Configure scrape parameters
      const scrapeParams = {
        // Request multiple formats for fallback
        formats: ['extract', 'markdown', 'html', 'screenshot', 'links'],

        // Use structured extraction with schema
        extract: {
          schema: this.productSchema,
          prompt: extractionPrompt,
          systemPrompt: "You are an expert at extracting e-commerce product data. Extract accurate product information from the page."
        },

        // Site-specific actions (click buttons, wait for content, etc.)
        actions: siteConfig.actions || [],

        // Performance optimization
        timeout: siteConfig.timeout || options.timeout || 60000, // Use site-specific timeout first
        waitFor: siteConfig.waitFor || options.waitFor || 3000,

        // Advanced options
        onlyMainContent: true,
        removeBase64Images: siteConfig.removeBase64Images !== undefined ? siteConfig.removeBase64Images : true,
        blockAds: true,
        mobile: false,
        proxy: siteConfig.requiresProxy ? 'stealth' : 'basic',

        // Custom headers if needed
        headers: siteConfig.headers || {},

        // Location spoofing for geo-restricted sites
        location: siteConfig.location || {
          country: 'US',
          languages: ['en-US']
        }
      };

      // Execute scrape
      const result = await this.firecrawl.scrapeUrl(url, scrapeParams);

      if (!result || !result.success) {
        const errorMsg = result?.error || 'Scraping failed';
        console.error('❌ Firecrawl failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Firecrawl V2 scrape successful');

      // Process the structured extraction
      const product = this.processExtraction(result, url);

      // Prepare final result
      const finalResult = {
        success: true,
        product
      };

      // Cache the result
      this.setCache(url, finalResult);

      // Track metrics
      if (metrics) {
        metrics.recordAttempt('v2', url, startTime, finalResult);
      }

      return finalResult;

    } catch (error) {
      console.error('❌ Firecrawl V2 error:', error.message);

      // Check if this is a timeout error and we should retry
      const isTimeoutError = error.message.includes('timed out') || error.message.includes('408');
      const shouldRetry = isTimeoutError && currentRetry < maxRetries;

      if (shouldRetry) {
        console.log(`🔄 Timeout detected, retrying (${currentRetry + 1}/${maxRetries})...`);

        // Wait 2 seconds before retry to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Retry with incremented counter
        return this.scrape(url, {
          ...options,
          currentRetry: currentRetry + 1,
          maxRetries: maxRetries
        });
      }

      // Attempt fallback with simpler extraction after all retries exhausted
      if (options.allowFallback !== false) {
        console.log('⚠️ All retries exhausted, attempting fallback extraction...');
        return this.fallbackScrape(url, options);
      }

      const result = {
        success: false,
        error: error.message,
        retriesAttempted: currentRetry
      };

      // Track metrics
      if (metrics) {
        metrics.recordAttempt('v2', url, startTime, result);
      }

      return result;
    }
  }

  /**
   * Process extraction result into normalized format
   */
  processExtraction(result, url) {
    const extracted = result.extract || {};
    const metadata = result.metadata || {};

    // Build product object from extraction
    const product = {
      // Core fields from structured extraction
      product_name: extracted.name || metadata.ogTitle || metadata.title || '',
      brand: extracted.brand || this.extractBrandFromUrl(url) || 'Unknown',
      sale_price: extracted.price || 0,
      original_price: extracted.originalPrice || extracted.price || 0,
      currency: extracted.currency || 'USD',
      description: extracted.description || metadata.description || '',
      image_urls: this.normalizeImages(extracted.images || [], result.screenshot, result.links || [], url, result.html),

      // Additional fields
      is_on_sale: extracted.originalPrice && extracted.originalPrice > extracted.price,
      discount_percentage: null,
      in_stock: extracted.inStock !== false,
      sku: extracted.sku || '',
      color: extracted.color || '',
      size: extracted.size || '',
      sizes: extracted.sizes || [],
      material: extracted.material || '',
      category: extracted.category || this.inferCategory(extracted.name, extracted.description),

      // Metadata
      vendor_url: url,
      platform: this.getPlatformFromUrl(url),
      scraped_at: new Date().toISOString(),
      scraper: 'firecrawl-v2',
      confidence: result.extract ? 0.9 : 0.5,

      // Include screenshot if available
      screenshot_url: result.screenshot || null,

      // Raw data for debugging
      _raw: {
        markdown: result.markdown?.substring(0, 500),
        links: result.links?.slice(0, 10)
      }
    };

    // Calculate discount if on sale
    if (product.is_on_sale) {
      product.discount_percentage = Math.round(
        (1 - product.sale_price / product.original_price) * 100
      );
    }

    return product;
  }

  /**
   * Get site-specific configuration
   */
  getSiteConfig(url) {
    const hostname = new URL(url).hostname.toLowerCase();

    const configs = {
      // High protection sites
      'ssense.com': {
        waitFor: 6000,
        requiresProxy: true,
        timeout: 90000,  // 90 second timeout - SSENSE has heavy bot protection
        removeBase64Images: false, // Keep base64 images for SSENSE product gallery
        actions: [
          { type: 'wait', milliseconds: 2000 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 1500 },
          { type: 'scroll', direction: 'up' } // Scroll back up to ensure main images are loaded
        ]
      },
      'rei.com': {
        waitFor: 10000,  // Increased wait time for REI
        requiresProxy: true,
        timeout: 60000,  // 60 second timeout for REI specifically
        actions: [
          { type: 'wait', milliseconds: 3000 },  // Initial wait
          { type: 'wait', selector: '[data-ui="product-price"]', timeout: 10000 },
          { type: 'scroll', direction: 'down' },  // Trigger lazy loading
          { type: 'wait', milliseconds: 2000 },  // Wait after scroll
          { type: 'screenshot', fullPage: false }
        ]
      },
      'nordstromrack.com': {
        waitFor: 5000,
        requiresProxy: true,
        actions: [
          { type: 'wait', milliseconds: 3000 },
          { type: 'click', selector: '.size-selector', all: false },
          { type: 'wait', milliseconds: 1000 }
        ]
      },
      'net-a-porter.com': {
        waitFor: 8000,  // Increased from 6000 - NAP needs more time to load
        requiresProxy: true,
        timeout: 60000,  // Increased to 60 seconds - NAP is very slow
        location: {
          country: 'US',
          languages: ['en-US']
        },
        actions: [
          { type: 'wait', milliseconds: 5000 },  // Wait longer before scrolling
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 2000 },  // Wait after scroll
          { type: 'scroll', direction: 'down' }  // Scroll again to load more images
        ]
      },
      'farfetch.com': {
        waitFor: 8000,
        requiresProxy: true,
        actions: [
          { type: 'wait', milliseconds: 4000 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 2000 }
        ]
      },
      'saksfifthavenue.com': {
        waitFor: 6000,
        requiresProxy: true,
        actions: [
          { type: 'wait', selector: '.product-pricing' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'ralphlauren.com': {
        waitFor: 7000,
        requiresProxy: true,
        timeout: 60000,
        actions: [
          { type: 'wait', milliseconds: 3000 },
          { type: 'wait', selector: '.product-detail, .product-wrapper' },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 2000 },
          { type: 'screenshot', fullPage: false }
        ]
      },

      // Medium protection sites
      'zara.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', selector: '.product-detail-info' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'hm.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', milliseconds: 2000 },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'cos.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', selector: '.product-detail' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'aritzia.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', milliseconds: 2500 },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'freepeople.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', selector: '.c-product-meta' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'anthropologie.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', selector: '.c-product-meta' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'urbanoutfitters.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', selector: '.c-product-meta' },
          { type: 'scroll', direction: 'down' }
        ]
      },

      // Luxury sites
      'gucci.com': {
        waitFor: 7000,
        requiresProxy: true,
        location: {
          country: 'US',
          languages: ['en-US']
        },
        actions: [
          { type: 'wait', milliseconds: 3000 },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'louisvuitton.com': {
        waitFor: 8000,
        requiresProxy: true,
        location: {
          country: 'US',
          languages: ['en-US']
        },
        actions: [
          { type: 'wait', milliseconds: 4000 }
        ]
      },
      'balenciaga.com': {
        waitFor: 6000,
        requiresProxy: true,
        actions: [
          { type: 'wait', milliseconds: 3000 },
          { type: 'scroll', direction: 'down' }
        ]
      },

      // Athletic/Outdoor sites
      'nike.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', selector: '.product-price' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'adidas.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', selector: '.product-price' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'lululemon.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', selector: '.price' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'patagonia.com': {
        waitFor: 4000,
        actions: [
          { type: 'wait', selector: '.product-price' },
          { type: 'scroll', direction: 'down' }
        ]
      },
      'arcteryx.com': {
        waitFor: 5000,
        actions: [
          { type: 'wait', milliseconds: 2500 },
          { type: 'scroll', direction: 'down' }
        ]
      }
    };

    // Find matching config
    for (const [domain, config] of Object.entries(configs)) {
      if (hostname.includes(domain)) {
        console.log(`📋 Using site config for ${domain}`);
        return config;
      }
    }

    // Default config
    return {
      waitFor: 3000,
      requiresProxy: false,
      actions: []
    };
  }

  /**
   * Build extraction prompt based on site
   */
  buildExtractionPrompt(url) {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('ssense.com')) {
      return "Extract product details from SSENSE. CRITICAL: Find ALL product images from the image gallery/carousel (typically 4-8 images showing different angles). Include: designer/brand name, product name, sale price, original price, color, material composition from description, and ALL image URLs from the product gallery.";
    }

    if (hostname.includes('rei.com')) {
      return "Extract outdoor gear product details from REI. Include brand, product name, price (check for member pricing), and technical specifications.";
    }

    if (hostname.includes('nordstrom')) {
      return "Extract fashion product from Nordstrom/Nordstrom Rack. Get brand, product name, current price, original price if on sale, available sizes, and colors.";
    }

    if (hostname.includes('ralphlauren')) {
      return "Extract Ralph Lauren product details. Include product name, price, all product images, description, available sizes, colors, and material composition if available.";
    }

    if (hostname.includes('net-a-porter')) {
      return "Extract luxury fashion product from NET-A-PORTER. CRITICAL: Find ALL product images from the image carousel/gallery (typically 5-10 images). Include: designer/brand name, product name, current price, original price if on sale, color/variant, detailed material composition, sizes available, and ALL image URLs from the product gallery.";
    }

    // Generic prompt
    return "Extract complete e-commerce product information including name, brand, price, images, description, sizes, colors, and availability.";
  }

  /**
   * Fallback scraping with simpler approach
   */
  async fallbackScrape(url, options = {}) {
    console.log('⚠️ Attempting fallback scrape with basic extraction');

    try {
      const result = await this.firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html', 'screenshot'],
        timeout: options.timeout || 30000,
        waitFor: 2000,
        onlyMainContent: true
      });

      if (!result.success) {
        throw new Error(result.error || 'Fallback scrape failed');
      }

      // Manual extraction from markdown/HTML
      const product = this.manualExtraction(result, url);

      return {
        success: true,
        product,
        fallback: true
      };
    } catch (error) {
      console.error('❌ Fallback also failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual extraction from markdown/HTML (fallback)
   */
  manualExtraction(result, url) {
    const markdown = result.markdown || '';
    const metadata = result.metadata || {};

    // Extract price using regex
    const priceMatch = markdown.match(/\$([0-9,]+\.?\d*)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

    // Extract images from markdown links
    const imageMatches = markdown.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g);
    const images = Array.from(imageMatches).map(match => match[1]);

    return {
      product_name: metadata.title || this.extractFirstHeading(markdown) || '',
      brand: this.extractBrandFromUrl(url) || 'Unknown',
      sale_price: price,
      original_price: price,
      currency: 'USD',
      description: metadata.description || markdown.substring(0, 500),
      image_urls: images.length > 0 ? images : [result.screenshot].filter(Boolean),
      vendor_url: url,
      platform: this.getPlatformFromUrl(url),
      scraped_at: new Date().toISOString(),
      scraper: 'firecrawl-v2-fallback',
      confidence: 0.3,
      is_manual_extraction: true
    };
  }

  /**
   * Helper: Extract brand from URL
   */
  extractBrandFromUrl(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    const brandMap = {
      'zara.com': 'Zara',
      'hm.com': 'H&M',
      'rei.com': 'REI Co-op',
      'ssense.com': 'SSENSE',
      'nordstrom': 'Nordstrom',
      'nike.com': 'Nike',
      'adidas.com': 'Adidas',
      'ralphlauren.com': 'Ralph Lauren'
    };

    for (const [domain, brand] of Object.entries(brandMap)) {
      if (hostname.includes(domain)) {
        return brand;
      }
    }

    return null;
  }

  /**
   * Helper: Get platform from URL
   */
  getPlatformFromUrl(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace('www.', '').split('.')[0];
  }

  /**
   * Helper: Extract first heading from markdown
   */
  extractFirstHeading(markdown) {
    const match = markdown.match(/^#+ (.+)$/m);
    return match ? match[1].trim() : '';
  }

  /**
   * Helper: Normalize image URLs
   */
  normalizeImages(images, screenshot, links = [], url = '', html = '') {
    const hostname = url ? new URL(url).hostname.toLowerCase() : '';

    // SSENSE-specific handling: Parse HTML directly for product images
    // This ensures we get the correct product images with class "product-detail"
    if (hostname.includes('ssense.com')) {
      console.log(`🔍 SSENSE detected - extracting product images from HTML`);

      let ssenseImages = [];

      // Try HTML parsing first (most accurate for SSENSE)
      if (html) {
        console.log(`🔍 Searching HTML for SSENSE product images`);

        // Strategy: Split HTML at "You May Also Like" or similar recommendation sections
        // Images before this are likely the actual product images
        const recommendationMarkers = [
          'You May Also Like',
          'may-also-like',
          'recommendations',
          'Similar Products',
          'Related Products'
        ];

        let productSectionHtml = html;
        for (const marker of recommendationMarkers) {
          const markerIndex = html.toLowerCase().indexOf(marker.toLowerCase());
          if (markerIndex > 0) {
            productSectionHtml = html.substring(0, markerIndex);
            console.log(`📌 Found "${marker}" at position ${markerIndex}, splitting HTML`);
            break;
          }
        }

        console.log(`📏 Product section HTML length: ${productSectionHtml.length} chars (total: ${html.length})`);

        // Extract from data-srcset attributes (SSENSE uses lazy loading)
        // Looking for: <img class="product-detail-new no-blur" data-srcset="https://img.ssensemedia.com/..." />
        const dataSrcsetRegex = /data-srcset="([^"]*img\.ssensemedia\.com[^"]*)"/gi;
        const srcsetRegex = /srcset="([^"]*ssensemedia[^"]*)"/gi;

        // Try data-srcset first
        let dataSrcsetMatches = [...productSectionHtml.matchAll(dataSrcsetRegex)];
        console.log(`🔍 Found ${dataSrcsetMatches.length} data-srcset matches`);

        dataSrcsetMatches.forEach(match => {
          const url = match[1];
          if (url && url.startsWith('http')) {
            // Clean up URL
            const cleanUrl = url.split(' ')[0].trim(); // Remove responsive image sizes
            if (!ssenseImages.includes(cleanUrl)) {
              ssenseImages.push(cleanUrl);
            }
          }
        });

        // If data-srcset didn't work, try regular srcset
        if (ssenseImages.length === 0) {
          console.log(`🔍 Trying regular srcset...`);
          let srcsetMatches = [...productSectionHtml.matchAll(srcsetRegex)];
          console.log(`🔍 Found ${srcsetMatches.length} srcset matches`);

          srcsetMatches.forEach(match => {
            const content = match[1];
            if (content && content.includes('ssensemedia')) {
              // Parse srcset which can have multiple URLs
              const urls = content.split(',').map(s => s.trim().split(' ')[0]);
              urls.forEach(url => {
                if (url.startsWith('http') && !ssenseImages.includes(url)) {
                  ssenseImages.push(url);
                }
              });
            }
          });
        }

        // Old fallback patterns if needed
        if (ssenseImages.length === 0) {
          console.log(`🔍 Trying fallback patterns...`);
          const patterns = [
            /https:\/\/img\.ssensemedia\.com\/images\/[^"'\s,]+\.jpg/gi,
            /data-src="([^"]*ssensemedia[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
          ];

          for (const pattern of patterns) {
            const matches = [...(productSectionHtml.matchAll(pattern) || [])];
            for (const match of matches) {
              const content = match[1] || match[0];

            // Handle srcset (multiple URLs with sizes)
            if (content.includes(',') && content.includes('ssensemedia')) {
              const urls = content.split(',');
              for (const url of urls) {
                const cleanUrl = url.trim().split(' ')[0];
                if (cleanUrl.includes('ssensemedia') && cleanUrl.match(/\.(jpg|jpeg|png|webp)/)) {
                  const finalUrl = cleanUrl
                    .replace(/\\/g, '')
                    .replace(/^["']|["']$/g, '')
                    .replace(/%2F/g, '/')
                    .replace(/%3A/g, ':')
                    .split('?')[0];
                  if (finalUrl.startsWith('http') && !ssenseImages.includes(finalUrl)) {
                    ssenseImages.push(finalUrl);
                  }
                }
              }
            } else if (content.includes('ssensemedia') && content.match(/\.(jpg|jpeg|png|webp)/)) {
              const finalUrl = content
                .replace(/\\/g, '')
                .replace(/^["']|["']$/g, '')
                .replace(/%2F/g, '/')
                .replace(/%3A/g, ':')
                .split('?')[0];
              if (finalUrl.startsWith('http') && !ssenseImages.includes(finalUrl)) {
                ssenseImages.push(finalUrl);
              }
            }
            }
          }
        }

        console.log(`📊 Found ${ssenseImages.length} SSENSE images in product section`);

        if (ssenseImages.length > 0) {
          // Clean up URLs
          const cleanedImages = ssenseImages.map(img => {
            try {
              // Handle relative URLs or malformed URLs
              if (!img.startsWith('http')) {
                return null;
              }
              const imgUrl = new URL(img);
              return imgUrl.origin + imgUrl.pathname;
            } catch {
              return null;
            }
          }).filter(img => img && img.includes('/images/'));

          // Group by image number (e.g., _1, _2, _3) and keep only highest resolution
          // SSENSE has multiple resolutions for each angle, we want the highest
          const imageGroups = {};

          cleanedImages.forEach(img => {
            // Extract image number: 252020F016006_1, 252020F016006_2, etc.
            const imageNumMatch = img.match(/\/(\d{6}[A-Z]\d{6}_\d+)\//);
            if (imageNumMatch) {
              const imageNum = imageNumMatch[1]; // e.g., "252020F016006_1"

              if (!imageGroups[imageNum]) {
                imageGroups[imageNum] = [];
              }
              imageGroups[imageNum].push(img);
            }
          });

          // For each image number, pick the highest resolution version
          // Look for "h_2800" or "c_limit" which indicates high-res
          const bestImages = [];
          const imageNums = Object.keys(imageGroups).sort(); // Sort to maintain order

          imageNums.forEach(imageNum => {
            const urls = imageGroups[imageNum];

            // Prefer images with "h_2800" or "c_limit,h_2800" (highest resolution)
            const highRes = urls.find(url => url.includes('h_2800') && url.includes('c_limit'));

            if (highRes) {
              bestImages.push(highRes);
            } else {
              // Fallback to first URL if no high-res found
              bestImages.push(urls[0]);
            }
          });

          if (bestImages.length > 0) {
            console.log(`📸 Found ${bestImages.length} SSENSE product images (deduplicated by resolution)`);
            return bestImages.slice(0, 8);
          }

          // Fallback: just deduplicate and take first 8
          const deduped = [...new Set(cleanedImages)].slice(0, 8);
          console.log(`📸 Found ${deduped.length} SSENSE images from HTML (no grouping)`);
          return deduped;
        }
      }

      // Fallback: Try link extraction with SKU grouping
      if (links && links.length > 0) {
        console.log(`🔍 No images in HTML, trying link extraction with SKU grouping`);

        const allSsenseImages = links
          .filter(link => {
            if (!link.includes('img.ssensemedia.com/images/')) return false;
            if (!link.match(/\.(jpg|jpeg|png|webp)/)) return false;
            return true;
          })
          .map(link => {
            try {
              const imgUrl = new URL(link);
              return imgUrl.origin + imgUrl.pathname;
            } catch {
              return link;
            }
          });

        if (allSsenseImages.length > 0) {
          // Group images by SKU prefix
          const skuGroups = {};

          allSsenseImages.forEach(img => {
            const skuMatch = img.match(/\/(\d{6}[A-Z]\d{6})(?:_\d+)?\//);
            if (skuMatch) {
              const sku = skuMatch[1];
              if (!skuGroups[sku]) {
                skuGroups[sku] = [];
              }
              skuGroups[sku].push(img);
            }
          });

          const skus = Object.keys(skuGroups);
          if (skus.length > 0) {
            const mainSku = skus.sort((a, b) => skuGroups[b].length - skuGroups[a].length)[0];
            const mainImages = [...new Set(skuGroups[mainSku])].slice(0, 8);

            console.log(`📸 Found ${mainImages.length} SSENSE product images (SKU: ${mainSku}, ${skus.length} total SKUs found)`);
            return mainImages;
          }

          const limitedImages = [...new Set(allSsenseImages)].slice(0, 8);
          console.log(`📸 Found ${limitedImages.length} SSENSE images (SKU grouping failed, using first 8)`);
          return limitedImages;
        }
      }

      console.log('⚠️ No SSENSE images found in HTML or links, falling back to AI-extracted images');
    }

    // Default normalization for non-SSENSE sites or fallback
    const normalized = images
      .filter(img => img && img.startsWith('http'))
      .map(img => {
        // Remove query parameters for cleaner URLs
        try {
          const url = new URL(img);
          return url.origin + url.pathname;
        } catch {
          return img;
        }
      });

    // Fallback: If we got very few images (1-2), try to extract from links
    // This helps with sites where AI extraction misses gallery images
    if (normalized.length <= 2 && links && links.length > 0) {

      // Generic fallback: look for any product images in links
      if (normalized.length <= 2) {
        const additionalImages = links
          .filter(link =>
            link.startsWith('http') &&
            link.match(/\.(jpg|jpeg|png|webp)/) &&
            !link.includes('logo') &&
            !link.includes('icon') &&
            !link.includes('avatar')
          )
          .slice(0, 10) // Limit to prevent too many irrelevant images
          .map(link => {
            try {
              const imgUrl = new URL(link);
              return imgUrl.origin + imgUrl.pathname;
            } catch {
              return link;
            }
          });

        if (additionalImages.length > 0) {
          console.log(`📸 Found ${additionalImages.length} additional images from links`);
          normalized.push(...additionalImages);
        }
      }
    }

    // Add screenshot as last resort if no images
    if (normalized.length === 0 && screenshot) {
      normalized.push(screenshot);
    }

    return [...new Set(normalized)]; // Remove duplicates
  }

  /**
   * Helper: Infer category from product data
   */
  inferCategory(name = '', description = '') {
    const text = `${name} ${description}`.toLowerCase();

    const categories = {
      'Clothing': ['shirt', 'pants', 'dress', 'jacket', 'coat', 'sweater', 'jeans', 'skirt', 'blouse'],
      'Shoes': ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'oxford'],
      'Bags': ['bag', 'purse', 'backpack', 'tote', 'clutch', 'wallet'],
      'Accessories': ['watch', 'jewelry', 'necklace', 'bracelet', 'ring', 'sunglasses', 'belt'],
      'Outerwear': ['jacket', 'coat', 'parka', 'windbreaker', 'raincoat'],
      'Activewear': ['athletic', 'workout', 'yoga', 'running', 'gym', 'sports']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Batch scraping for multiple URLs (more efficient)
   */
  async batchScrape(urls, options = {}) {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API key not configured');
    }

    console.log(`🔥 Batch scraping ${urls.length} URLs`);

    try {
      // Filter out cached URLs
      const uncachedUrls = urls.filter(url => !this.getCached(url));

      if (uncachedUrls.length === 0) {
        console.log('📦 All URLs are cached');
        return urls.map(url => this.getCached(url));
      }

      // Use Firecrawl's batch API for efficiency
      const batchId = await this.firecrawl.batchScrapeUrls(
        uncachedUrls,
        {
          formats: ['extract', 'markdown', 'screenshot'],
          extract: {
            schema: this.productSchema,
            prompt: "Extract e-commerce product information"
          },
          ...options
        }
      );

      // Wait for batch to complete
      const results = await this.firecrawl.batchScrapeUrlsAndWatch(
        batchId,
        (status) => {
          console.log(`Batch progress: ${status.completed}/${status.total}`);
        }
      );

      // Process results
      const processedResults = results.map((result, index) => {
        const url = uncachedUrls[index];
        const processed = this.processExtraction(result, url);
        this.setCache(url, { success: true, product: processed });
        return { success: true, product: processed };
      });

      // Combine with cached results
      return urls.map(url => {
        const cached = this.getCached(url);
        if (cached) return cached;
        const index = uncachedUrls.indexOf(url);
        return processedResults[index];
      });

    } catch (error) {
      console.error('❌ Batch scrape failed:', error.message);
      // Fall back to individual scraping
      return Promise.all(urls.map(url => this.scrape(url, options)));
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
}

module.exports = FirecrawlParserV2;