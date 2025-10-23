const cheerio = require('cheerio');
const axios = require('axios');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const vm = require('vm');
const { getProxyConfig, getAxiosConfig } = require('./config/proxy');
const { getHostnameFallbackUrl, isDnsResolutionError } = require('./utils/url-normalizer');

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());

class UniversalParserV3 {
  constructor() {
    this.version = '3.1.4'; // Fixed malformed protocol URLs (https:files -> https://domain/files)
    this.browserInstance = null;
    this.cache = new Map();
    this.apiDataCache = new Map(); // Cache for intercepted API data
    this.metrics = {
      attempts: 0,
      successes: 0,
      failures: 0,
      apiInterceptions: 0,
      byStrategy: {
        direct: { attempts: 0, successes: 0 },
        puppeteer: { attempts: 0, successes: 0 },
        api: { attempts: 0, successes: 0 }
      }
    };

    // Sites that require browser rendering
    this.requiresBrowser = new Set([
      'zara.com',
      'farfetch.com',
      'ssense.com',
      'net-a-porter.com',
      'cultgaia.com',
      'matchesfashion.com',
      'mytheresa.com',
      'wconcept.com',
      'aritzia.com',
      'revolve.com',
      'fwrd.com',
      'nordstrom.com',
      'saksfifthavenue.com',
      'bloomingdales.com',
      'uniqlo.com'  // Added - loads price dynamically
    ]);

    // Sites that block axios requests
    this.blocksDirectFetch = new Set([
      'cos.com',
      'arket.com',
      'stories.com',
      'hm.com',
      'www2.hm.com',
      'aritzia.com',
      'urbanoutfitters.com'
    ]);

    // API patterns to intercept for each site
    this.apiPatterns = {
      'uniqlo.com': [
        /api.*product/i,
        /graphql/i,
        /pricing/i,
        /inventory/i,
        /hmall-d/i,  // Uniqlo's API endpoint
        /data.*product/i,
        /query/i
      ],
      'nordstrom.com': [
        /api.*product/i,
        /style.*api/i,
        /price/i
      ],
      'zara.com': [
        /api.*product/i,
        /commercial/i,
        /availability/i
      ],
      'farfetch.com': [
        /api.*product/i,
        /graphql/i,
        /listing/i
      ],
      'ssense.com': [
        /api.*product/i,
        /graphql/i,
        /plp-products/i
      ],
      'net-a-porter.com': [
        /api.*product/i,
        /nap/i,
        /yoox/i
      ],
      'bloomingdales.com': [
        /api.*product/i,
        /xapi/i,
        /digital/i
      ],
      'saksfifthavenue.com': [
        /api.*product/i,
        /catalog/i,
        /graphql/i
      ]
    };

    // Enhanced site-specific patterns
    this.sitePatterns = {
      'zara.com': {
        name: ['h1.product-detail-info__header-name', '.product-name', '[data-qa-qualifier="product-name"]'],
        price: ['.price-current__amount', '.price__amount-current', '[data-qa-qualifier="product-price"]'],
        images: ['.media-image img', '.product-detail-images__image img', 'picture.media-image source'],
        brand: () => 'Zara'
      },
      'cos.com': {
        name: ['h1[itemprop="name"]', '.product-item-headline', 'h1.ProductName'],
        price: ['span[itemprop="price"]', '.product-item-price', '.ProductPrice'],
        images: ['.product-detail-main__images img', '.product-images img', '.slick-slide img'],
        brand: () => 'COS'
      },
      'hm.com': {
        name: ['h1.product-item-header', '.primary.product-item-headline', 'h1[data-test="product-name"]'],
        price: ['.price.parbase', 'span[data-test="product-price"]', '.ProductPrice-module--productItemPrice__3K5pF'],
        images: ['.product-detail-main-image-container img', '.product-detail-thumbnail-image'],
        brand: () => 'H&M'
      },
      'uniqlo.com': {
        name: ['h1.product-name', '.product-main-info h1', '[data-test="product-title"]', 'h1.fr-ec-title'],
        price: ['.fr-ec-price-text', '.price-now', '.product-main-info__price', '[data-test="product-price-now"]', '.fr-ec-price'],
        images: ['.fr-ec-image__image img', '.product-main-image img', '.product-image-carousel img', '.slick-slide img'],
        brand: () => 'Uniqlo'
      },
      'aritzia.com': {
        name: ['h1.product-name', '.pdp-product-name h1', '[data-test-id="product-name"]'],
        price: ['.product-price', '.pdp-product-price', '[data-test-id="product-price"]'],
        images: ['.product-image img', '.pdp-image img', '.product-images-carousel img'],
        brand: () => 'Aritzia'
      },
      'net-a-porter.com': {
        name: ['span.ProductDetails24__name', '.product-name', 'h1[itemprop="name"]'],
        price: ['.PriceWithSchema9__value', '.product-price', 'span[itemprop="price"]'],
        images: ['.ProductImageCarousel__image img', '.product-image img', '.swiper-slide img'],
        brand: ['span.ProductDetails24__designer', '.product-designer', '[itemprop="brand"]']
      },
      'ssense.com': {
        name: ['h1.product-name', '.product-name-price h1', 'h1[itemprop="name"]'],
        price: ['.product-price', '.price-group span', 'span[itemprop="price"]'],
        images: ['.product-images-container img', '.image-container img'],
        brand: ['.product-brand', '.product-name-price p', '[itemprop="brand"]']
      },
      'nordstrom.com': {
        name: ['h1.eAjwI', 'h1[itemprop="name"]', '.ProductTitle__ProductName'],
        price: ['.cjvZl', 'span[itemprop="price"]', '.Price__PriceAmount'],
        images: ['.ZoomImage__Image img', '.ProductMediaList__Image img'],
        brand: ['.JZkLE', '[itemprop="brand"]', '.ProductTitle__Brand']
      },
      'farfetch.com': {
        name: ['h1._3f80c9', 'h1[itemprop="name"]', '.product-detail-info h1'],
        price: ['span._0d415e', 'span[itemprop="price"]', '.product-detail-price'],
        images: ['.product-detail-image img', '.slick-slide img'],
        brand: ['a._27d965', '[itemprop="brand"]', '.product-detail-brand']
      },
      'miumiu.com': {
        name: ['h1.product-name', '.product-title', '[itemprop="name"]'],
        price: ['.price', '[itemprop="price"]', '.product-price'],
        images: ['.product-image img', '.gallery-image img'],
        brand: () => 'Miu Miu'
      },
      '69mcfly.com': {
        name: ['h1.product_title', 'h1'],
        price: ['.woocommerce-Price-amount.amount', '.price .woocommerce-Price-amount', 'span.amount', '.price'],
        images: [
          '.woocommerce-product-gallery__wrapper img',
          '.woocommerce-product-gallery__image img',
          '.iconic-woothumbs-thumbnails__image-wrapper img',
          '.product-entry-slider-wrap img',
          '.single-product .woocommerce-product-gallery img'
        ],
        brand: () => '69mcfly'
      }
    };

    // Generic patterns as fallback
    this.genericPatterns = {
      name: [
        'h1',
        '.product-name',
        '.product-title',
        '[itemprop="name"]',
        '[data-testid="product-name"]',
        '.pdp-name',
        '.product-info h1'
      ],
      price: [
        '.price',
        '.product-price',
        '[itemprop="price"]',
        '.price-now',
        '.sale-price',
        '.current-price',
        '[data-testid="product-price"]',
        '.pdp-price',
        '.price-sales'
      ],
      images: [
        '.product-image img',
        '.product-photo img',
        '.gallery img',
        '.swiper-slide img',
        'picture img',
        '[data-testid="product-image"] img',
        '.pdp-image img',
        '.product-images img',
        '.product-img',
        '.product-thumbnail img',
        'div[class*="product"] img',
        'div[class*="Product"] img',
        'img[class*="product"]',
        'img[class*="Product"]',
        '[itemprop="image"]',
        '.main-image',
        '.zoom-image',
        'a[href*=".jpg"] img',
        'a[href*=".png"] img',
        'a[href*=".webp"] img'
      ],
      brand: [
        '.brand',
        '.product-brand',
        '[itemprop="brand"]',
        '.designer',
        '.vendor',
        '.manufacturer'
      ]
    };

    this.logLevel = process.env.UNIVERSAL_LOG_LEVEL || 'normal';

    // Load patterns from database on initialization
    this.loadPatternsFromDatabase();
  }

  async loadPatternsFromDatabase() {
    try {
      const patternFile = './pattern-db.json';
      const data = await fs.readFile(patternFile, 'utf8');
      const patterns = JSON.parse(data);

      // Merge database patterns with hardcoded patterns
      for (const [hostname, siteData] of Object.entries(patterns)) {
        if (hostname.startsWith('_') || !siteData.patterns) continue; // Skip metadata

        // If site already has hardcoded patterns, merge them
        if (this.sitePatterns[hostname]) {
          this.sitePatterns[hostname] = {
            ...this.sitePatterns[hostname],
            ...siteData.patterns
          };
        } else {
          // Add new site patterns from database
          this.sitePatterns[hostname] = siteData.patterns;
        }
      }

      console.log('✅ Loaded patterns from database for', Object.keys(patterns).filter(k => !k.startsWith('_')).length, 'sites');
      console.log('🔍 69mcfly patterns loaded:', JSON.stringify(this.sitePatterns['69mcfly.com'], null, 2));
    } catch (error) {
      if (this.logLevel === 'verbose') {
        console.log('⚠️ Could not load pattern database:', error.message);
      }
    }
  }

  async getBrowser() {
    if (!this.browserInstance) {
      this.browserInstance = await puppeteerExtra.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    }
    return this.browserInstance;
  }

  async parse(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    this.metrics.attempts++;

    if (this.logLevel !== 'quiet') {
      console.log(`\n🧠 Universal Parser V3 attempting: ${hostname}`);
    }

    // Check cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      if (this.logLevel === 'verbose') {
        console.log('📦 Returning cached result');
      }
      return cached.data;
    }

    try {
      let html;
      let interceptedData = null;
      let strategy = 'direct';

      // Determine fetch strategy
      if (this.requiresBrowser.has(hostname) || this.blocksDirectFetch.has(hostname)) {
        strategy = 'puppeteer';
        const result = await this.fetchWithPuppeteerAndIntercept(url, hostname);
        html = result.html;
        interceptedData = result.interceptedData;
      } else {
        // Try direct fetch first
        try {
          html = await this.fetchDirect(url);
          // Quick check if we got real content
          if (html.length < 5000 || !html.includes('product')) {
            if (this.logLevel === 'verbose') {
              console.log('⚠️  Minimal HTML received, trying Puppeteer with interception');
            }
            strategy = 'puppeteer';
            const result = await this.fetchWithPuppeteerAndIntercept(url, hostname);
            html = result.html;
            interceptedData = result.interceptedData;
          }
        } catch (error) {
          if (error.response?.status === 403 || error.response?.status === 429) {
            if (this.logLevel === 'verbose') {
              console.log(`⚠️  ${error.response.status} error, trying Puppeteer with interception`);
            }
            strategy = 'puppeteer';
            const result = await this.fetchWithPuppeteerAndIntercept(url, hostname);
            html = result.html;
            interceptedData = result.interceptedData;
          } else {
            throw error;
          }
        }
      }

      this.metrics.byStrategy[strategy].attempts++;

      // Parse HTML
      const $ = cheerio.load(html);
      let result = await this.extractData($, hostname, url);

      // Enhance with intercepted API data if available
      if (interceptedData) {
        result = this.mergeApiData(result, interceptedData);
        if (this.logLevel === 'verbose') {
          console.log('🎯 Enhanced with API data:', {
            hadPrice: !!interceptedData.price,
            hadName: !!interceptedData.name,
            hadImages: interceptedData.images?.length > 0
          });
        }
      }

      if (result.confidence > 0.5) {
        this.metrics.successes++;
        this.metrics.byStrategy[strategy].successes++;

        // Cache successful results
        this.cache.set(url, {
          data: result,
          timestamp: Date.now()
        });

        // Learn from success (save patterns)
        await this.learnFromSuccess(hostname, result, $);
      } else {
        this.metrics.failures++;
      }

      if (this.logLevel === 'verbose') {
        console.log('📊 Extraction result:', {
          strategy,
          confidence: result.confidence,
          hasName: !!result.name,
          hasPrice: !!result.price,
          imageCount: result.images?.length || 0,
          apiDataUsed: !!interceptedData
        });
      }

      return result;

    } catch (error) {
      this.metrics.failures++;
      console.error(`❌ Parser error for ${url}:`, error.message);
      return {
        error: error.message,
        confidence: 0,
        url
      };
    }
  }

  async fetchDirect(url) {
    let requestUrl = url;
    const buildAxiosConfig = (targetUrl) => getAxiosConfig(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    let axiosConfig = buildAxiosConfig(requestUrl);
    let response;

    try {
      response = await axios.get(requestUrl, axiosConfig);
    } catch (error) {
      if (isDnsResolutionError(error)) {
        const fallbackUrl = getHostnameFallbackUrl(requestUrl);
        if (fallbackUrl) {
          console.log('🔁 DNS fallback: retrying direct fetch without www prefix');
          requestUrl = fallbackUrl;
          axiosConfig = buildAxiosConfig(requestUrl);
          response = await axios.get(requestUrl, axiosConfig);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    return response.data;
  }

  async fetchWithPuppeteerAndIntercept(url, hostname) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const interceptedData = {
      price: null,
      name: null,
      images: [],
      brand: null,
      variants: []
    };

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Enable request interception
      await page.setRequestInterception(true);

      // Set up request/response interceptors
      const apiPatterns = this.apiPatterns[hostname] || [/api/i, /graphql/i, /product/i];

      page.on('request', request => {
        // Continue all requests
        request.continue();
      });

      page.on('response', async response => {
        const url = response.url();
        const status = response.status();

        // Check if this is an API call we're interested in
        const isApiCall = apiPatterns.some(pattern => pattern.test(url));

        if (isApiCall && status === 200) {
          try {
            const contentType = response.headers()['content-type'] || '';

            if (contentType.includes('application/json')) {
              const data = await response.json();

              // Extract data from various API response formats
              this.extractFromApiResponse(data, interceptedData, hostname);

              if (this.logLevel === 'verbose') {
                console.log(`🎯 Intercepted API: ${url.substring(0, 80)}...`);
              }

              this.metrics.apiInterceptions++;
            }
          } catch (e) {
            // Silently ignore parsing errors for non-JSON responses
          }
        }
      });

      // Navigate with increased timeout
      let navigationUrl = url;
      try {
        await page.goto(navigationUrl, {
          waitUntil: 'domcontentloaded',  // Faster than networkidle0
          timeout: 20000
        });
      } catch (error) {
        if (isDnsResolutionError(error)) {
          const fallbackUrl = getHostnameFallbackUrl(navigationUrl);
          if (fallbackUrl) {
            console.log('🔁 DNS fallback: retrying Puppeteer navigation without www prefix');
            navigationUrl = fallbackUrl;
            await page.goto(navigationUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Wait for common product elements
      try {
        await page.waitForSelector('h1, .product-name, .product-title, [data-testid="product-name"]', {
          timeout: 5000
        });
      } catch (e) {
        // Continue even if selector not found
      }

      // Scroll to trigger lazy loading and API calls
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      // Wait for API calls to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Scroll more to ensure all content loads
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const html = await page.content();

      return { html, interceptedData };

    } finally {
      await page.close();
    }
  }

  extractFromApiResponse(data, interceptedData, hostname) {
    // Generic extraction patterns that work across many sites
    const searchObject = (obj, depth = 0) => {
      if (depth > 10 || !obj) return;

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Price extraction
        if (!interceptedData.price &&
            (lowerKey.includes('price') || lowerKey === 'amount' || lowerKey === 'cost')) {
          if (typeof value === 'number' && value > 0 && value < 100000) {
            interceptedData.price = value;
          } else if (typeof value === 'string' && /\d/.test(value)) {
            const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
              interceptedData.price = parsed;
            }
          }
        }

        // Name extraction
        if (!interceptedData.name &&
            (lowerKey === 'name' || lowerKey === 'title' || lowerKey === 'productname')) {
          if (typeof value === 'string' && value.length > 3 && value.length < 200) {
            interceptedData.name = value;
          }
        }

        // Brand extraction
        if (!interceptedData.brand &&
            (lowerKey === 'brand' || lowerKey === 'manufacturer' || lowerKey === 'vendor')) {
          if (typeof value === 'string' && value.length > 1 && value.length < 100) {
            interceptedData.brand = value;
          }
        }

        // Image extraction
        if (lowerKey.includes('image') || lowerKey === 'url' || lowerKey === 'src') {
          if (typeof value === 'string' && value.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
            if (!interceptedData.images.includes(value)) {
              interceptedData.images.push(value);
            }
          } else if (Array.isArray(value)) {
            value.forEach(img => {
              if (typeof img === 'string' && img.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                if (!interceptedData.images.includes(img)) {
                  interceptedData.images.push(img);
                }
              }
            });
          }
        }

        // Recursive search
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (typeof item === 'object') {
                searchObject(item, depth + 1);
              }
            });
          } else {
            searchObject(value, depth + 1);
          }
        }
      }
    };

    // Site-specific patterns
    if (hostname === 'uniqlo.com') {
      // Uniqlo specific patterns
      if (data.result?.price?.promo?.value) {
        interceptedData.price = data.result.price.promo.value;
      } else if (data.result?.price?.base?.value) {
        interceptedData.price = data.result.price.base.value;
      } else if (data.result?.priceGroup) {
        // Price groups API response
        if (data.result.priceGroup.salePrice) {
          interceptedData.price = parseFloat(data.result.priceGroup.salePrice.value);
        } else if (data.result.priceGroup.promoPrice) {
          interceptedData.price = parseFloat(data.result.priceGroup.promoPrice.value);
        } else if (data.result.priceGroup.price) {
          interceptedData.price = parseFloat(data.result.priceGroup.price.value);
        }
      } else if (data.priceGroup) {
        // Direct price group response
        if (data.priceGroup.salePrice?.value) {
          interceptedData.price = parseFloat(data.priceGroup.salePrice.value);
        } else if (data.priceGroup.price?.value) {
          interceptedData.price = parseFloat(data.priceGroup.price.value);
        }
      }

      if (data.result?.name) {
        interceptedData.name = data.result.name;
      } else if (data.name) {
        interceptedData.name = data.name;
      }
    }

    // GraphQL responses
    if (data.data?.product) {
      const product = data.data.product;
      if (product.price) interceptedData.price = parseFloat(product.price);
      if (product.name) interceptedData.name = product.name;
      if (product.brand) interceptedData.brand = product.brand;
      if (product.images) interceptedData.images = product.images;
    }

    // Run generic search
    searchObject(data);
  }

  mergeApiData(result, apiData) {
    // Merge intercepted API data with scraped data
    if (!result.price && apiData.price) {
      result.price = apiData.price;
      result.priceSource = 'api';
    }

    if (!result.name && apiData.name) {
      result.name = apiData.name;
      result.nameSource = 'api';
    }

    if (!result.brand && apiData.brand) {
      result.brand = apiData.brand;
      result.brandSource = 'api';
    }

    if ((!result.images || result.images.length === 0) && apiData.images.length > 0) {
      result.images = apiData.images;
      result.imagesSource = 'api';
    }

    // Recalculate confidence with API data
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  async extractData($, hostname, url) {
    const result = {
      url,
      confidence: 0
    };

    // Check if this is a Shopify store
    const isShopify = this.detectShopify($);

    // Handle Shopify variant URLs
    if (url.includes('variant=')) {
      const variantData = await this.extractShopifyVariant($, url);
      if (variantData) {
        Object.assign(result, variantData);
      }
    }

    // If it's a Shopify store, extract images differently
    if (isShopify) {
      const shopifyImages = this.extractShopifyImages($);
      if (shopifyImages.length > 0) {
        result.images = shopifyImages;
      }
      if (this.logLevel === 'verbose') {
        console.log('🛍️ Detected Shopify store, using Shopify-specific image extraction');
      }
    }

    // Try multiple extraction strategies
    const strategies = [
      this.extractJsonLd($),
      this.extractNextJsData($),
      this.extractOpenGraph($),
      this.extractSiteSpecific($, hostname),
      this.extractGeneric($)
    ];

    // Merge results from all strategies
    for (const strategy of strategies) {
      if (strategy.name && !result.name) result.name = strategy.name;
      if (strategy.price && !result.price) result.price = strategy.price;
      if (strategy.brand && !result.brand) result.brand = strategy.brand;

      // Only merge images if we don't already have Shopify images
      if (!isShopify && strategy.images?.length > 0) {
        if (!result.images) result.images = [];
        // Merge images from all strategies, avoiding duplicates
        for (const img of strategy.images) {
          // Normalize URLs for duplicate checking (remove query params)
          const isDuplicate = result.images.some(existingImg => {
            try {
              const newUrl = new URL(img);
              const existingUrl = new URL(existingImg);
              // Compare origin + pathname (ignore query params)
              return newUrl.origin === existingUrl.origin && newUrl.pathname === existingUrl.pathname;
            } catch {
              // If URL parsing fails, fall back to simple string comparison
              return existingImg === img;
            }
          });

          if (!isDuplicate) {
            result.images.push(img);
          }
        }
      }
      if (strategy.description && !result.description) result.description = strategy.description;
    }

    // Extract inline gallery data used by some storefront themes (e.g., Hyvä)
    const inlineImages = this.extractInitialImages($);
    if (inlineImages.length > 0) {
      result.images = inlineImages;
    }

    // Calculate confidence
    result.confidence = this.calculateConfidence(result);

    // Normalize data
    if (result.price) {
      result.price = this.normalizePrice(result.price);
    }
    if (result.images) {
      result.images = this.normalizeImages(result.images, url);
    }

    return result;
  }

  /**
   * Validate if a URL is actually an image URL
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Must be an HTTP(S) URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

    // Check if it has image extension
    const hasImageExtension = /\.(jpg|jpeg|png|webp|gif|avif|svg)($|\?|#)/i.test(url);

    // OR check if it's from a known CDN
    const isFromCDN = url.includes('cdn') ||
                      url.includes('cloudfront') ||
                      url.includes('cloudinary') ||
                      url.includes('imgix') ||
                      url.includes('akamai');

    if (hasImageExtension || isFromCDN) {
      // Additional validation: must not be suspiciously short
      const path = url.split('?')[0].split('#')[0];
      const pathSegment = path.split('/').pop();

      // If the last path segment is too short (like "/jcb"), it's probably not an image
      if (pathSegment && pathSegment.length < 8 && !hasImageExtension) {
        return false;
      }

      return true;
    }

    return false;
  }

  extractJsonLd($) {
    const result = {};
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const scriptContent = $(elem).html();
        if (!scriptContent || scriptContent.trim().length === 0) {
          return; // Skip empty script tags
        }

        let data = JSON.parse(scriptContent);

        // Handle @graph wrapper (common in WordPress/WooCommerce)
        if (data['@graph'] && Array.isArray(data['@graph'])) {
          const productData = data['@graph'].find(item => item['@type'] === 'Product');
          if (productData) data = productData;
        }

        if (data['@type'] === 'Product' || data.mainEntity?.['@type'] === 'Product') {
          const product = data.mainEntity || data;
          result.name = product.name;

          // Handle offers array (WooCommerce format)
          if (Array.isArray(product.offers) && product.offers.length > 0) {
            result.price = parseFloat(product.offers[0].price);
          } else {
            result.price = product.offers?.price || product.price;
          }

          // Handle brand - could be object with @id or string
          if (product.brand) {
            if (typeof product.brand === 'string') {
              result.brand = product.brand;
            } else if (product.brand.name) {
              result.brand = product.brand.name;
            } else if (product.brand['@id']) {
              // Extract from URL if it's just an @id reference
              const brandId = product.brand['@id'];
              const brandMatch = brandId.match(/\/\/([^/]+)/);
              if (brandMatch) {
                // Clean up the domain name to get brand
                const domain = brandMatch[1];
                if (domain.includes('speedyromeo')) {
                  result.brand = 'Speedy Romeo';
                } else {
                  result.brand = domain.split('.')[0];
                }
              }
            }
          }

          result.description = product.description;

          // Handle images - could be string, array, or object
          if (product.image) {
            const normalizeImageEntry = (img) => {
              if (!img) return null;

              if (typeof img === 'string') {
                // Validate that this is actually an image URL
                return this.isValidImageUrl(img) ? img : null;
              }

              if (Array.isArray(img)) {
                for (const entry of img) {
                  const normalized = normalizeImageEntry(entry);
                  if (normalized) return normalized;
                }
                return null;
              }

              if (typeof img === 'object') {
                const candidateKeys = [
                  'url',
                  'contentUrl',
                  'src',
                  'image',
                  'thumbnail',
                  '@id'
                ];

                for (const key of candidateKeys) {
                  if (img[key]) {
                    const normalized = normalizeImageEntry(img[key]);
                    if (normalized) return normalized;
                  }
                }

                // Fallback: scan object values for first image-like string
                for (const value of Object.values(img)) {
                  if (typeof value === 'string' && value.startsWith('http')) {
                    // Validate before returning
                    if (this.isValidImageUrl(value)) {
                      return value;
                    }
                  }
                  const normalized = normalizeImageEntry(value);
                  if (normalized) return normalized;
                }
              }

              return null;
            };

            const collectImages = (imageField) => {
              if (!imageField) return [];

              if (typeof imageField === 'string') {
                return this.isValidImageUrl(imageField) ? [imageField] : [];
              }

              if (Array.isArray(imageField)) {
                return imageField
                  .map(entry => normalizeImageEntry(entry))
                  .filter(Boolean);
              }

              if (typeof imageField === 'object') {
                const normalized = normalizeImageEntry(imageField);
                return normalized ? [normalized] : [];
              }

              return [];
            };

            const normalizedImages = collectImages(product.image);
            if (normalizedImages.length > 0) {
              result.images = normalizedImages;
            }
          }
        }
      } catch (e) {
        // Silent fail
      }
    });
    return result;
  }

  extractOpenGraph($) {
    return {
      name: $('meta[property="og:title"]').attr('content'),
      price: $('meta[property="og:price:amount"]').attr('content') ||
             $('meta[property="product:price:amount"]').attr('content'),
      images: [$('meta[property="og:image"]').attr('content')].filter(Boolean),
      description: $('meta[property="og:description"]').attr('content'),
      brand: $('meta[property="product:brand"]').attr('content')
    };
  }

  extractNextJsData($) {
    const result = {};
    const nextDataScript = $('#__NEXT_DATA__');

    if (nextDataScript.length > 0) {
      try {
        const scriptContent = nextDataScript.html();
        if (!scriptContent || scriptContent.trim().length === 0) {
          return result;
        }

        const nextData = JSON.parse(scriptContent);
        const pageProps = nextData?.props?.pageProps;

        if (pageProps?.product) {
          const product = pageProps.product;

          // Extract basic product info
          if (product.name) result.name = product.name;
          if (product.brand) result.brand = product.brand;
          if (product.description) result.description = product.description;

          // Extract price from priceRanges (Clarks format)
          if (product.priceRanges?.now) {
            const priceInCents = product.priceRanges.now.minPrice || product.priceRanges.now.maxPrice;
            if (priceInCents) {
              result.price = priceInCents / 100; // Convert cents to dollars
            }
          }

          // Extract images from imageUrls array (Clarks format)
          if (product.imageUrls && Array.isArray(product.imageUrls)) {
            result.images = product.imageUrls.filter(url => this.isValidImageUrl(url));
          }
          // Fallback to generic image field
          else if (product.images && Array.isArray(product.images)) {
            result.images = product.images.filter(url => this.isValidImageUrl(url));
          }
        }
      } catch (e) {
        // Silent fail
      }
    }

    return result;
  }

  extractSiteSpecific($, hostname) {
    const patterns = this.sitePatterns[hostname];
    if (!patterns) return {};

    const result = {};

    for (const [field, selectors] of Object.entries(patterns)) {
      if (typeof selectors === 'function') {
        result[field] = selectors();
        continue;
      }

      // Handle string values (static brand names from pattern database)
      if (typeof selectors === 'string') {
        result[field] = selectors;
        continue;
      }

      // Skip if selectors is not iterable
      if (!Array.isArray(selectors)) {
        continue;
      }

      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const images = [];
            $(selector).each((i, el) => {
              let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
              if (src) {
                if (src.includes(',')) {
                  src = src.split(',')[0].trim().split(' ')[0];
                }
                images.push(src);
              }
            });
            if (images.length > 0) {
              result[field] = images;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim();
            if (value) {
              result[field] = value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }

    return result;
  }

  extractGeneric($) {
    const result = {};

    for (const [field, selectors] of Object.entries(this.genericPatterns)) {
      for (const selector of selectors) {
        try {
          if (field === 'images') {
            const images = [];
            $(selector).slice(0, 10).each((i, el) => {
              let src = $(el).attr('src') ||
                       $(el).attr('data-src') ||
                       $(el).attr('data-srcset') ||
                       $(el).attr('srcset') ||
                       $(el).css('background-image');

              // Extract URL from background-image
              if (src && src.includes('url(')) {
                src = src.match(/url\(['"]?([^'"\)]+)['"]?\)/)?.[1];
              }

              // Clean srcset to get first URL
              if (src && src.includes(',')) {
                src = src.split(',')[0].trim().split(' ')[0];
              }

              // Filter out invalid/placeholder images
              if (src &&
                  !src.includes('placeholder') &&
                  !src.includes('loading') &&
                  !src.startsWith('data:image') &&
                  !src.includes('blank.gif') &&
                  !src.includes('transparent.png')) {
                images.push(src);
              }
            });
            if (images.length > 0) {
              result[field] = images;
              break;
            }
          } else {
            const value = $(selector).first().text()?.trim();
            if (value) {
              result[field] = value;
              break;
            }
          }
        } catch (e) {
          // Silent fail
        }
      }
    }

    return result;
  }

  calculateConfidence(result) {
    let score = 0;
    const weights = {
      name: 0.25,
      price: 0.25,
      images: 0.25,
      brand: 0.15,
      description: 0.10
    };

    for (const [field, weight] of Object.entries(weights)) {
      if (result[field]) {
        if (field === 'images' && result[field].length === 0) continue;
        score += weight;
      }
    }

    return Math.min(score, 1);
  }

  normalizePrice(price) {
    if (typeof price === 'number') return price;

    const cleaned = price.toString()
      .replace(/[^0-9.,]/g, '')
      .replace(',', '');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  normalizeImages(images, baseUrl) {
    if (!Array.isArray(images)) return [];

    const normalized = [];
    const baseUrlObj = new URL(baseUrl);

    for (let img of images) {
      if (!img || typeof img !== 'string') continue;

      // Handle malformed URLs like "https:files/..." (missing //)
      // Treat these as relative paths since they're broken
      if ((img.startsWith('https:') && !img.startsWith('https://')) ||
          (img.startsWith('http:') && !img.startsWith('http://'))) {
        // Extract the path part after the protocol
        const path = img.replace(/^https?:/, '');
        // Treat as relative path
        img = path.startsWith('/')
          ? `${baseUrlObj.protocol}//${baseUrlObj.host}${path}`
          : `${baseUrlObj.protocol}//${baseUrlObj.host}/${path}`;
      }
      // Handle protocol-relative URLs
      else if (img.startsWith('//')) {
        img = 'https:' + img;
      }
      // Handle relative URLs
      else if (img.startsWith('/')) {
        img = `${baseUrlObj.protocol}//${baseUrlObj.host}${img}`;
      }
      // Handle relative URLs without leading slash
      else if (!img.startsWith('http')) {
        img = `${baseUrlObj.protocol}//${baseUrlObj.host}/${img}`;
      }

      normalized.push(img);
    }

    return normalized.slice(0, 10);
  }

  extractInitialImages($) {
    const images = new Set();

    $('script').each((_, el) => {
      const content = $(el).html();
      if (!content) return;

      const trimmed = content.trim();
      if (!trimmed) return;

      // Some themes embed pure JSON in script tags (type="application/json")
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = this.safeParseInlineJson(trimmed);
        if (parsed) {
          this.collectImagesFromInlineData(parsed, images);
        }
      }

      if (!content.includes('initialImages')) {
        return;
      }

      let searchIndex = 0;
      const key = 'initialImages';

      while (true) {
        const keyIndex = content.indexOf(key, searchIndex);
        if (keyIndex === -1) break;

        const arrayStart = content.indexOf('[', keyIndex);
        if (arrayStart === -1) {
          searchIndex = keyIndex + key.length;
          continue;
        }

        const rawArray = this.extractBracketedArray(content, arrayStart);
        if (!rawArray) {
          searchIndex = arrayStart + 1;
          continue;
        }

        const parsedArray = this.safeParseInlineJson(rawArray);
        if (Array.isArray(parsedArray)) {
          this.collectInlineImagesFromArray(parsedArray, images);
        }

        searchIndex = arrayStart + rawArray.length;
      }
    });

    return Array.from(images);
  }

  collectImagesFromInlineData(data, images, depth = 0) {
    if (!data || depth > 3) return;

    if (Array.isArray(data)) {
      this.collectInlineImagesFromArray(data, images);
      return;
    }

    if (typeof data !== 'object') {
      return;
    }

    if (Array.isArray(data.initialImages)) {
      this.collectInlineImagesFromArray(data.initialImages, images);
    }

    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;
      const lowerKey = key.toLowerCase();

      if (Array.isArray(value) && lowerKey.includes('image')) {
        this.collectInlineImagesFromArray(value, images);
      } else if (typeof value === 'object') {
        if (lowerKey.includes('image') || depth < 2) {
          this.collectImagesFromInlineData(value, images, depth + 1);
        }
      }
    }
  }

  collectInlineImagesFromArray(items, images) {
    if (!Array.isArray(items)) return;

    const candidateKeys = [
      'full',
      'img',
      'src',
      'url',
      'image',
      'full_webp',
      'img_webp',
      'large',
      'medium',
      'small',
      'thumb',
      'desktop',
      'mobile'
    ];

    for (const item of items) {
      if (!item) continue;

      if (typeof item === 'string') {
        this.addImageCandidate(item, images);
        continue;
      }

      if (typeof item === 'object') {
        for (const key of candidateKeys) {
          const value = item[key];
          if (typeof value === 'string' && value.trim().length > 0) {
            this.addImageCandidate(value, images);
            break;
          }
        }
      }
    }
  }

  addImageCandidate(candidate, images) {
    if (typeof candidate !== 'string') return;

    let normalized = candidate.trim();
    if (!normalized) return;

    if (normalized.startsWith('//')) {
      normalized = `https:${normalized}`;
    }

    // Validate URL before adding to images set
    if (!this.isValidImageUrl(normalized)) {
      return; // Skip invalid image URLs
    }

    if (!images.has(normalized)) {
      images.add(normalized);
    }
  }

  extractBracketedArray(content, startIndex) {
    let depth = 0;
    let inString = false;
    let stringChar = null;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (inString) {
        if (char === '\\') {
          i++;
          continue;
        }
        if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
        continue;
      }

      if (char === '"' || char === '\'') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '[') {
        depth++;
      }

      if (char === ']') {
        depth--;
        if (depth === 0) {
          return content.slice(startIndex, i + 1);
        }
      }
    }

    return null;
  }

  safeParseInlineJson(raw) {
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch (jsonError) {
      try {
        return vm.runInNewContext(`(${trimmed})`, {}, { timeout: 50 });
      } catch (evalError) {
        if (this.logLevel === 'verbose') {
          console.log('⚠️ Failed to evaluate inline JSON:', evalError.message);
        }
        return null;
      }
    }
  }

  async learnFromSuccess(hostname, result, $) {
    // Save successful patterns for future use
    if (result.confidence < 0.7) return;

    try {
      const patternFile = './pattern-db.json';
      let patterns = {};

      try {
        const data = await fs.readFile(patternFile, 'utf8');
        patterns = JSON.parse(data);
      } catch (e) {
        patterns = {
          _meta: {
            version: '1.0',
            updated: new Date().toISOString()
          },
          global_patterns: this.genericPatterns
        };
      }

      // Update success count
      if (!patterns._meta.successful_extractions) {
        patterns._meta.successful_extractions = 0;
      }
      patterns._meta.successful_extractions++;
      patterns._meta.updated = new Date().toISOString();

      // Save the successful pattern for this site
      if (!patterns[hostname]) {
        patterns[hostname] = {
          successCount: 0,
          lastSuccess: new Date().toISOString(),
          patterns: {}
        };
      }

      patterns[hostname].successCount++;
      patterns[hostname].lastSuccess = new Date().toISOString();

      // Store which selectors worked
      const workingSelectors = {
        name: this.findWorkingSelector($, result.name, ['h1', '.product-name', '[itemprop="name"]']),
        price: this.findWorkingSelector($, result.price, ['.price', '.product-price', '[itemprop="price"]']),
        brand: result.brand
      };

      if (workingSelectors.name || workingSelectors.price) {
        patterns[hostname].patterns = workingSelectors;
      }

      await fs.writeFile(patternFile, JSON.stringify(patterns, null, 2));

      if (this.logLevel === 'verbose') {
        console.log(`📝 Learned patterns for ${hostname}`);
      }
    } catch (e) {
      // Silent fail - pattern learning is not critical
    }
  }

  findWorkingSelector($, value, selectors) {
    if (!value) return null;

    for (const selector of selectors) {
      try {
        const found = $(selector).first().text()?.trim();
        if (found && found.includes(value.toString().substring(0, 20))) {
          return selector;
        }
      } catch (e) {
        // Continue
      }
    }
    return null;
  }

  detectShopify($) {
    // Check for Shopify indicators
    // 1. Check og:image or og:image:url for cdn.shopify.com
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogImageUrl = $('meta[property="og:image:url"]').attr('content') || '';

    if (ogImage.includes('cdn.shopify.com') || ogImageUrl.includes('cdn.shopify.com')) {
      return true;
    }

    // 2. Check for Shopify-specific elements in HTML
    const shopifyIndicators = [
      'script[src*="cdn.shopify.com"]',
      'link[href*="cdn.shopify.com"]',
      'meta[name="shopify-checkout-api-token"]',
      'script:contains("window.Shopify")',
      'script:contains("Shopify.theme")'
    ];

    for (const selector of shopifyIndicators) {
      if ($(selector).length > 0) {
        return true;
      }
    }

    return false;
  }

  extractShopifyImages($) {
    const images = [];

    // 1. First try to get images from og:image tags (often high quality)
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogImageUrl = $('meta[property="og:image:url"]').attr('content');

    // Process OG image - remove crop parameters for higher resolution
    const processShopifyImage = (url) => {
      if (!url || !url.includes('cdn.shopify.com')) return null;

      // Remove crop and size parameters to get original image
      // From: https://cdn.shopify.com/s/files/1/2193/5809/files/I036942_3YM_XX-ST-01.jpg?v=1758648612&width=1200&height=630&crop=top
      // To: https://cdn.shopify.com/s/files/1/2193/5809/files/I036942_3YM_XX-ST-01.jpg?v=1758648612

      // Parse URL
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);

      // Remove size and crop parameters
      params.delete('width');
      params.delete('height');
      params.delete('crop');

      // Optionally add a higher resolution
      // params.set('width', '2048');

      urlObj.search = params.toString();
      return urlObj.toString();
    };

    // Add processed OG image
    if (ogImageUrl) {
      const processed = processShopifyImage(ogImageUrl);
      if (processed) images.push(processed);
    } else if (ogImage) {
      const processed = processShopifyImage(ogImage);
      if (processed) images.push(processed);
    }

    // 2. Find other product images with cdn.shopify.com
    $('img[src*="cdn.shopify.com"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('badge')) {
        // Skip srcset for Shopify - it often has broken format
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          images.push(processed);
        }
      }
    });

    // 3. Look for Shopify product gallery images
    $('.product__media img, .product-image img, .product-photo img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.includes('cdn.shopify.com')) {
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          images.push(processed);
        }
      }
    });

    // 4. Check for images in data attributes
    $('[data-src*="cdn.shopify.com"], [data-zoom*="cdn.shopify.com"]').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('data-zoom');
      if (src) {
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          images.push(processed);
        }
      }
    });

    return images.slice(0, 10); // Return max 10 images
  }

  async extractShopifyVariant($, url) {
    const variantId = new URL(url).searchParams.get('variant');
    if (!variantId) return null;

    const result = {};

    // Look for Shopify product JSON in script tags
    $('script').each((i, elem) => {
      const content = $(elem).html() || '';

      // Look for window.productJSON or similar patterns
      if (content.includes('product') && content.includes('variants')) {
        // Try to extract JSON from various patterns
        const patterns = [
          /window\.productJSON\s*=\s*({.*?});/s,
          /var\s+product\s*=\s*({.*?});/s,
          /Product:\s*({.*?})\s*[,}]/s,
          /"product":\s*({.*?})\s*[,}]/s
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            try {
              const productData = JSON.parse(match[1]);

              // Find the specific variant
              if (productData.variants) {
                const variant = productData.variants.find(v =>
                  v.id?.toString() === variantId ||
                  v.id === parseInt(variantId)
                );

                if (variant) {
                  // Extract variant-specific price
                  if (variant.price) {
                    // Convert cents to dollars if needed
                    result.price = typeof variant.price === 'number' && variant.price > 1000
                      ? variant.price / 100
                      : variant.price;
                  }

                  if (variant.compare_at_price) {
                    result.originalPrice = typeof variant.compare_at_price === 'number' && variant.compare_at_price > 1000
                      ? variant.compare_at_price / 100
                      : variant.compare_at_price;
                  }

                  result.variantTitle = variant.title || variant.name;
                  result.available = variant.available !== false;

                  console.log(`✅ Found variant ${variantId} with price: ${result.price}`);
                  return false; // Break out of each()
                }
              }
            } catch (e) {
              // Continue searching
            }
          }
        }
      }
    });

    // Also check for variant data in application/json script tags
    $('script[type="application/json"]').each((i, elem) => {
      try {
        const scriptContent = $(elem).html();
        if (!scriptContent || scriptContent.trim().length === 0) {
          return; // Skip empty script tags
        }

        const data = JSON.parse(scriptContent);

        if (data.product?.variants) {
          const variant = data.product.variants.find(v =>
            v.id?.toString() === variantId ||
            v.id === parseInt(variantId)
          );

          if (variant && !result.price) {
            result.price = typeof variant.price === 'number' && variant.price > 1000
              ? variant.price / 100
              : variant.price;

            if (variant.compare_at_price) {
              result.originalPrice = typeof variant.compare_at_price === 'number' && variant.compare_at_price > 1000
                ? variant.compare_at_price / 100
                : variant.compare_at_price;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    });

    return Object.keys(result).length > 0 ? result : null;
  }

  async cleanup() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.attempts > 0
        ? (this.metrics.successes / this.metrics.attempts * 100).toFixed(1) + '%'
        : '0%',
      apiInterceptionRate: this.metrics.apiInterceptions > 0
        ? `${this.metrics.apiInterceptions} API calls intercepted`
        : 'No API interceptions'
    };
  }
}

module.exports = UniversalParserV3;
