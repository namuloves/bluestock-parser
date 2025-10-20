const express = require('express');
const cors = require('cors');
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { scrapeProduct } = require('./scrapers');
const { enhanceWithAI } = require('./scrapers/ebay');
const ClaudeAIService = require('./services/claude-ai');
const SizeChartParser = require('./scrapers/sizeChartParser');
const SlackNotificationService = require('./services/slack-notifications');
const ProductEnhancer = require('./utils/productEnhancer');
const healthRoutes = require('./routes/health');
const duplicateCheckRoutes = require('./routes/duplicate-check');
const imageProxyRoutes = require('./routes/image-proxy');
const { getCDNService } = require('./services/bunny-cdn');
const BunnyStorageService = require('./services/bunny-storage');
const { getCurrencyDetector } = require('./services/currency-detector');
const { getCurrencyConverter } = require('./services/currency-converter');

// Import Universal Parser - V3 or LEAN based on environment
let UniversalParser = null;
let universalParser = null;
let leanParser = null;
let v3Parser = null;

// Import Rollout Configuration
const { getRolloutConfig } = require('./config/rollout-config');
const rolloutConfig = getRolloutConfig();

// Check which parser version to use
const PARSER_VERSION = process.env.PARSER_VERSION || 'v3'; // 'v3' or 'lean'

// Initialize both parsers for gradual rollout
try {
  // Always try to initialize V3 parser for fallback
  if (process.env.REDIS_ENABLED !== 'false') {
    UniversalParser = require('./universal-parser-v3-cached');
  } else {
    UniversalParser = require('./universal-parser-v3');
  }
  v3Parser = new UniversalParser();
  console.log('✅ Universal parser V3 initialized');

  // Also initialize lean parser if available
  try {
    const { getLeanParser } = require('./universal-parser-lean');
    leanParser = getLeanParser();
    console.log('✅ Universal Parser LEAN initialized (v4.0.0-lean) for rollout');
  } catch (leanError) {
    console.log('⚠️ Lean parser not available, using V3 only');
  }

  // Set the main parser reference based on configuration
  if (PARSER_VERSION === 'lean' && leanParser) {
    universalParser = leanParser;
    console.log('📌 Primary parser: LEAN (with V3 fallback)');
  } else {
    universalParser = v3Parser;
    console.log('📌 Primary parser: V3');
  }
} catch (error) {
  console.log('⚠️ Universal parser not available, using legacy scrapers only:', error.message);
}

// Initialize AI service if API key is available
let aiService = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()) {
  try {
    aiService = new ClaudeAIService();
    console.log('Claude AI service initialized');
  } catch (error) {
    console.log('Claude AI service not initialized:', error.message);
  }
} else {
  console.log('Claude AI service not initialized (no API key)');
}

// Initialize size chart parser
const sizeChartParser = new SizeChartParser();

// Initialize Bunny Storage service
const bunnyStorage = new BunnyStorageService();

// Initialize Slack notification service
const slackNotifications = new SlackNotificationService();

// Initialize Product Enhancer
const productEnhancer = new ProductEnhancer();

const app = express();
const PORT = process.env.PORT || 3001;

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit in production - try to recover
  if (process.env.NODE_ENV === 'production') {
    console.error('Attempting to continue despite error...');
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  // Don't exit in production - try to recover
  if (process.env.NODE_ENV === 'production') {
    console.error('Attempting to continue despite rejection...');
  } else {
    process.exit(1);
  }
});

// CORS configuration - fully open in production for now
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
      origin: true, // Allow ALL origins in production
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Accept', 'Origin'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
      maxAge: 86400,
      optionsSuccessStatus: 200
    }
  : {
      // Stricter in development
      origin: function (origin, callback) {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001'
        ];

        if (!origin) return callback(null, true);

        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('vercel.app')) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Accept', 'Origin'],
      optionsSuccessStatus: 200
    };

app.use(cors(corsOptions));
app.use(express.json());

// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Health check routes (before other routes)
app.use('/', healthRoutes);
app.use('/api', duplicateCheckRoutes);
app.use('/', imageProxyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('MMMMood Parser API is running!');
});

// Health endpoint moved to routes/health.js

// Redis connection test (remove after verifying)
app.get('/test-redis', async (req, res) => {
  try {
    const { getCache } = require('./cache/redis-cache');
    const cache = getCache();

    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    const metrics = await cache.getMetrics();

    res.json({
      status: 'Redis test endpoint',
      environment: {
        redis_url_set: !!process.env.REDIS_URL,
        redis_host_set: !!process.env.REDIS_HOST,
        redis_password_set: !!process.env.REDIS_PASSWORD,
        redis_enabled: process.env.REDIS_ENABLED !== 'false'
      },
      connection: {
        connected: metrics.connected,
        enabled: metrics.enabled
      },
      metrics: metrics
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Serve dashboard HTML
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Debug SSENSE endpoint
app.get('/debug-ssense', async (req, res) => {
  try {
    const { scrapeSsenseSimple } = require('./scrapers/ssense-simple');
    const testUrl = 'https://www.ssense.com/en-us/women/product/still-kelly/black-workwear-trousers/18061791';
    console.log('🔍 Debug: Testing SSENSE simple scraper directly');
    const result = await scrapeSsenseSimple(testUrl);
    res.json({
      success: true,
      message: 'SSENSE simple scraper test',
      result
    });
  } catch (error) {
    console.error('Debug SSENSE error:', error);
    res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Slack test endpoint
app.get('/test-slack', async (req, res) => {
  try {
    const success = await slackNotifications.sendTestNotification();
    res.json({
      success: success,
      message: success ? 'Slack test notification sent!' : 'Slack test failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to send Slack test notification'
    });
  }
});

// Enhancement metrics endpoint
app.get('/enhancement-metrics', (req, res) => {
  try {
    const metrics = productEnhancer.getMetrics();
    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get enhancement metrics'
    });
  }
});

// Firecrawl V2 metrics endpoint
app.get('/api/firecrawl/metrics', (req, res) => {
  try {
    const { getFirecrawlMetrics } = require('./services/firecrawl-metrics');
    const firecrawlMetrics = getFirecrawlMetrics();

    const metrics = firecrawlMetrics.getMetrics();
    const recommendations = firecrawlMetrics.getRecommendations();

    res.json({
      success: true,
      metrics,
      recommendations,
      config: {
        v2_enabled: process.env.FIRECRAWL_V2 !== 'false',
        v2_percentage: process.env.FIRECRAWL_V2_PERCENTAGE || '100',
        firecrawl_api_configured: !!process.env.FIRECRAWL_API_KEY
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get Firecrawl metrics'
    });
  }
});

// Reset Firecrawl metrics (admin only)
app.post('/api/firecrawl/metrics/reset', (req, res) => {
  try {
    // Check for admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { getFirecrawlMetrics } = require('./services/firecrawl-metrics');
    const firecrawlMetrics = getFirecrawlMetrics();
    firecrawlMetrics.reset();

    res.json({
      success: true,
      message: 'Firecrawl metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to reset Firecrawl metrics'
    });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  // Read the actual parser file to check what's deployed
  const fs = require('fs');
  let parserVersion = 'unknown';
  let hasSpeedyRomeoFix = false;

  try {
    const parserCode = fs.readFileSync('./universal-parser-v3.js', 'utf8');
    // Check for the version string
    const versionMatch = parserCode.match(/this\.version = ['"]([^'"]+)['"]/);
    if (versionMatch) {
      parserVersion = versionMatch[1];
    }
    // Check for Speedy Romeo fix
    hasSpeedyRomeoFix = parserCode.includes('speedyromeo');
  } catch (e) {
    parserVersion = 'error: ' + e.message;
  }

  res.json({
    status: 'OK',
    service: 'mmmmood-parser',
    timestamp: new Date().toISOString(),
    message: 'Parser service is running and accessible!',
    parserVersion: parserVersion,
    hasSpeedyRomeoFix: hasSpeedyRomeoFix,
    universalParserLoaded: !!universalParser,
    proxy: {
      USE_PROXY: process.env.USE_PROXY,
      hasDecodoUsername: !!process.env.DECODO_USERNAME,
      hasDecodoPassword: !!process.env.DECODO_PASSWORD,
      proxyEnabled: process.env.USE_PROXY === 'true' || (!!process.env.DECODO_USERNAME && !!process.env.DECODO_PASSWORD),
      note: 'Proxy auto-enables when Decodo credentials are present'
    }
  });
});

// Debug endpoint for Foot Industry price issue
app.get('/debug-foot', async (req, res) => {
  const url = 'https://footindustry.com/en-en/collections/all/products/new-ballet-brown-antique-white';

  try {
    const result = await scrapeProduct(url);

    res.json({
      debug: true,
      timestamp: new Date().toISOString(),
      raw_price: result.product?.price,
      raw_sale_price: result.product?.sale_price,
      raw_original_price: result.product?.original_price,
      type_price: typeof result.product?.price,
      type_sale_price: typeof result.product?.sale_price,
      expected: 183,
      matches: result.product?.sale_price === 183
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  console.log('📥 /scrape endpoint hit');
  
  // Check if this is a Massimo Dutti URL that needs more time
  const url = req.body.url || '';
  const needsLongerTimeout = url.includes('massimodutti.com') ||
                             url.includes('net-a-porter.com') ||
                             url.includes('ssense.com') ||
                             url.includes('fwrd.com') ||
                             url.includes('rei.com');
  
  // Set a timeout for the entire request (60 seconds for protected sites, 30 for others)
  const timeoutDuration = needsLongerTimeout ? 60000 : 30000;
  const timeout = setTimeout(() => {
    console.log(`⏱️ Request timeout after ${timeoutDuration/1000} seconds`);
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Request timeout - the site may have anti-bot protection'
      });
    }
  }, timeoutDuration);
  
  try {
    const { url } = req.body;
    
    if (!url) {
      clearTimeout(timeout);
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }
    
    console.log('🔍 Scraping URL:', url);
    console.log('🔍 Scraping started at:', new Date().toISOString());

    let scrapeResult = null;

    // Check if this requires a dedicated scraper - use dedicated scraper for better results
    const hostname = new URL(url).hostname.toLowerCase();
    const useDedicatedScraper = hostname.includes('zara.com') ||
                               hostname.includes('ebay.com') ||
                               hostname.includes('ebay.') ||
                               hostname.includes('wconcept.com');

    // Import Quality Gate for validation
    const { getQualityGate } = require('./utils/qualityGate');
    const qualityGate = getQualityGate();

    // GRADUAL ROLLOUT: Determine which parser to use
    let parseResult = null;
    let parserUsed = 'none';

    if (!useDedicatedScraper) {
      // Get parser decision from rollout config
      const decision = rolloutConfig.getParserDecision(url);
      console.log(`🎯 Parser decision for ${new URL(url).hostname}: ${decision.useLeanParser ? 'LEAN' : 'V3'} (${decision.reason})`);

      // Use the selected parser
      if (decision.useLeanParser && leanParser) {
        try {
          console.log(`🧠 Attempting Universal Parser LEAN...`);
          console.log('📌 Parser version:', leanParser.version || 'v4.0.0-lean');
          parseResult = await leanParser.parse(url);
          parserUsed = 'lean';

          if (parseResult.success) {
            console.log(`✅ Lean Parser succeeded`);
            console.log(`📌 Plugins used: ${parseResult.plugins_used?.join(', ') || 'none'}`);
            console.log(`🌐 Rendered: ${parseResult.rendered ? 'Yes' : 'No'}`);
            rolloutConfig.recordResult(url, 'lean', true);
          } else {
            console.log(`❌ Lean Parser failed: ${parseResult.errors?.[0]?.message || parseResult.error}`);
            rolloutConfig.recordResult(url, 'lean', false);

            // FALLBACK: Try V3 parser if lean failed and we're in fallback mode
            if (rolloutConfig.mode === 'primary_with_fallback' && v3Parser) {
              console.log(`🔄 Falling back to V3 parser...`);
              try {
                parseResult = await v3Parser.parse(url);
                parserUsed = 'v3-fallback';
                rolloutConfig.recordResult(url, 'legacy', !!parseResult, true);
                console.log(`✅ V3 fallback ${parseResult ? 'succeeded' : 'failed'}`);
              } catch (v3Error) {
                console.log(`❌ V3 fallback also failed: ${v3Error.message}`);
                rolloutConfig.recordResult(url, 'legacy', false, true);
              }
            }
          }
        } catch (leanError) {
          console.log(`❌ Lean Parser error: ${leanError.message}`);
          rolloutConfig.recordResult(url, 'lean', false);

          // FALLBACK: Try V3 parser if lean errored
          if (rolloutConfig.mode === 'primary_with_fallback' && v3Parser) {
            console.log(`🔄 Falling back to V3 parser after lean error...`);
            try {
              parseResult = await v3Parser.parse(url);
              parserUsed = 'v3-fallback';
              rolloutConfig.recordResult(url, 'legacy', !!parseResult, true);
            } catch (v3Error) {
              console.log(`❌ V3 fallback also failed: ${v3Error.message}`);
              rolloutConfig.recordResult(url, 'legacy', false, true);
            }
          }
        }
      } else if (v3Parser) {
        // Use V3 parser
        try {
          console.log(`🧠 Attempting Universal Parser V3...`);
          console.log('📌 Parser version:', v3Parser.version || 'v3');
          parseResult = await v3Parser.parse(url);
          parserUsed = 'v3';
          rolloutConfig.recordResult(url, 'legacy', !!parseResult);
        } catch (v3Error) {
          console.log(`❌ V3 Parser error: ${v3Error.message}`);
          rolloutConfig.recordResult(url, 'legacy', false);
        }
      }

      // Process parse result if we got one
      if (parseResult) {
        // Handle different parser formats
        let v3Result;
        if (parserUsed === 'lean' || parserUsed === 'v3-fallback') {
          // Lean parser returns { success, product, ... }
          if (parseResult.success) {
            v3Result = parseResult.product;

            // Mitigation: lean parser sometimes returns limited media (e.g., single image)
            const imageCount = Array.isArray(v3Result?.images) ? v3Result.images.length : 0;
            if (parserUsed === 'lean' && v3Parser && imageCount <= 1) {
              try {
                console.log(`⚠️ Lean parser returned ${imageCount} images. Fetching V3 parser for richer gallery...`);
                const richResult = await v3Parser.parse(url);

                if (richResult && Array.isArray(richResult.images) && richResult.images.length > imageCount) {
                  console.log(`✅ V3 parser provided ${richResult.images.length} images (was ${imageCount}). Merging results.`);

                  v3Result.images = richResult.images;
                  v3Result.image_urls = richResult.images;

                  // Merge any missing descriptive fields from V3 result without overriding lean-specific data
                  if (!v3Result.description && richResult.description) v3Result.description = richResult.description;
                  if (!v3Result.brand && richResult.brand) v3Result.brand = richResult.brand;
                  if (!v3Result.price && richResult.price) v3Result.price = richResult.price;
                  if (!v3Result.currency && richResult.currency) v3Result.currency = richResult.currency;

                  rolloutConfig.recordResult(url, 'legacy', true, true);
                } else {
                  console.log('ℹ️ V3 parser did not improve image count. Keeping lean parser output.');
                }
              } catch (richError) {
                console.log(`❌ V3 enrichment failed: ${richError.message}`);
                rolloutConfig.recordResult(url, 'legacy', false, true);
              }
            }
          } else {
            v3Result = parseResult.partial_data || {};
          }
        } else {
          // V3 parser returns data directly
          v3Result = parseResult;
        }

        // Skip Quality Gate for lean parser (already validated internally)
        let validatedProduct;
        if ((parserUsed === 'lean' || parserUsed === 'v3-fallback') && parseResult.success) {
          // Lean parser already validated with Quality Gate
          validatedProduct = v3Result;
        } else if ((parserUsed === 'lean' || parserUsed === 'v3-fallback') && !parseResult.success && v3Result) {
          // Lean parser failed validation but returned data - notify about invalid product
          console.log(`⚠️ Lean parser returned invalid product data`);
          
          if (slackNotifications) {
            try {
              await slackNotifications.notifyInvalidProduct({
                url: url,
                product: {
                  name: v3Result.name,
                  brand: v3Result.brand,
                  price: v3Result.price,
                  images: v3Result.images || [],
                  description: v3Result.description
                },
                validationErrors: parseResult.errors || [],
                userEmail: req.body.userEmail || 'Anonymous',
                timestamp: new Date().toISOString()
              });
            } catch (notificationError) {
              console.error('Failed to send invalid product notification:', notificationError);
            }
          }
          
          validatedProduct = null;
        } else {
          // V3 parser needs Quality Gate validation
          const validation = qualityGate.validate({
            name: v3Result.name,
            price: v3Result.price,
            images: v3Result.images || [],
            brand: v3Result.brand,
            description: v3Result.description,
            sale_price: v3Result.salePrice || v3Result.sale_price,
            currency: v3Result.currency || 'USD',
            url: url
          });

          // Deprecation warning for confidence scores
          if (v3Result.confidence !== undefined) {
            console.log(`[DEPRECATION] Confidence score (${v3Result.confidence}) is deprecated. Using Quality Gate validation.`);
          }

          if (validation.valid) {
            console.log(`✅ Parser passed Quality Gate validation`);

            if (validation.warnings.length > 0) {
              console.log(`⚠️ Warnings: ${validation.warnings.map(w => w.message).join(', ')}`);
            }

            validatedProduct = validation.product;
          } else {
            console.log(`❌ Parser failed Quality Gate: ${validation.errors.map(e => e.message).join(', ')}`);
            validatedProduct = null;
          }
        }

        if (validatedProduct) {
          // Convert to expected format
          scrapeResult = {
            success: true,
            product: {
              name: validatedProduct.name,
              product_name: validatedProduct.name,
              brand: validatedProduct.brand || 'Unknown',
              price: validatedProduct.price,
              original_price: v3Result.originalPrice || validatedProduct.price,
              sale_price: validatedProduct.sale_price || validatedProduct.price,
              images: validatedProduct.images,
              image_urls: validatedProduct.images,
              description: validatedProduct.description || '',
              is_on_sale: !!validatedProduct.sale_price,
              discount_percentage: validatedProduct.sale_price
                ? Math.round((1 - validatedProduct.sale_price / validatedProduct.price) * 100)
                : null,
              platform: 'universal-v3',
              validation: 'quality-gate',
              source: 'universal-parser-v3'
            }
          };
        } else {
          console.log(`❌ Parser failed Quality Gate validation`);
          
          // Send notification for invalid product data
          if (slackNotifications && v3Result) {
            try {
              await slackNotifications.notifyInvalidProduct({
                url: url,
                product: {
                  name: v3Result.name,
                  brand: v3Result.brand,
                  price: v3Result.price,
                  images: v3Result.images || [],
                  description: v3Result.description
                },
                validationErrors: validation.errors,
                userEmail: req.body.userEmail || 'Anonymous',
                timestamp: new Date().toISOString()
              });
            } catch (notificationError) {
              console.error('Failed to send invalid product notification:', notificationError);
            }
          }
        }
      }
    }

    // Fall back to legacy scrapers if V3 didn't succeed (or for dedicated scrapers)
    if (!scrapeResult || !scrapeResult.success) {
      if (useDedicatedScraper) {
        console.log('🛍️ Using dedicated scraper for enhanced image extraction...');
      } else {
        console.log('📦 Falling back to legacy scrapers...');
      }

      // Use actual scraper with race condition against timeout
      const scrapePromise = scrapeProduct(url);
      // Increase timeout to 90 seconds for Apify requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Scraping timeout')), 90000)
      );

      scrapeResult = await Promise.race([scrapePromise, timeoutPromise]);
    }
    
    console.log('🔍 Scrape result:', {
      success: scrapeResult.success,
      hasProduct: !!scrapeResult.product,
      productName: scrapeResult.product?.name || scrapeResult.product?.product_name || 'No name',
      error: scrapeResult.error
    });
    
    // Check if scraping returned a product directly or wrapped in success/product
    let productData;
    
    // If it has a success field, check if it succeeded
    if ('success' in scrapeResult) {
      if (!scrapeResult.success) {
        return res.status(400).json(scrapeResult);
      }
      productData = scrapeResult.product || {};
    } else {
      // Direct product object (like Farfetch returns)
      productData = scrapeResult;
    }
    
    // If it's an eBay product with AI context and we have AI service, enhance it
    console.log('Product platform:', productData.platform);
    console.log('Has AI context:', !!productData.aiContext);
    console.log('AI service available:', !!aiService);
    
    if (productData.platform === 'ebay' && productData.aiContext && aiService) {
      console.log('🤖 Enhancing eBay product with AI description...');
      try {
        productData = await enhanceWithAI(productData, aiService);
        console.log('✅ AI description added:', productData.description);
      } catch (error) {
        console.error('AI enhancement failed:', error);
      }
    }
    
    // ENHANCEMENT PIPELINE: Add color, category, material detection
    console.log('🎨 Running product enhancement pipeline...');
    try {
      const enhancementStartTime = Date.now();

      // Run enhancement pipeline with timeout
      const enhancedData = await Promise.race([
        productEnhancer.enhance(productData, '', url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Enhancement timeout')), 8000)
        )
      ]);

      // Merge enhanced data with original product data
      productData = { ...productData, ...enhancedData };

      const enhancementTime = Date.now() - enhancementStartTime;
      console.log(`✅ Enhancement completed in ${enhancementTime}ms`);

      // Log enhancement results
      if (enhancedData.color) console.log(`🎨 Color detected: ${enhancedData.color}`);
      if (enhancedData.category) console.log(`📂 Category detected: ${enhancedData.category}`);
      if (enhancedData.material) console.log(`🧶 Material detected: ${enhancedData.material}`);
      if (enhancedData.gender) console.log(`👤 Gender detected: ${enhancedData.gender}`);

    } catch (error) {
      console.log(`⚠️ Enhancement failed (falling back to basic data): ${error.message}`);
    }

    // CURRENCY DETECTION (NO CONVERSION - KEEP ORIGINAL PRICES)
    console.log('💱 Detecting currency...');
    try {
      const currencyDetector = getCurrencyDetector();

      // Get HTML content for detection (if available)
      const htmlContent = scrapeResult.html || '';

      // Get price text for detection
      const priceText = productData.price_text ||
                       productData.sale_price?.toString() ||
                       productData.price?.toString() || '';

      // Detect currency
      const currencyInfo = currencyDetector.detect(htmlContent, url, priceText);
      console.log(`💰 Detected currency: ${currencyInfo.currency} (confidence: ${currencyInfo.confidence})`);

      // Store currency info
      productData.currency = currencyInfo.currency;

      // Keep prices as-is in their original currency
      console.log(`💵 Storing price as: ${productData.sale_price || productData.price} ${currencyInfo.currency}`);

    } catch (error) {
      console.error('⚠️ Currency detection failed:', error.message);
      // Default to USD if detection fails
      productData.currency = 'USD';
    }

    // Filter out invalid image URLs (payment icons, contact info, etc.)
    const isValidImageUrl = (url) => {
      if (!url) return false;
      const invalidPatterns = [
        'supports3DS', 'postalAddress', 'email', 'phone', 'visa', 'masterCard', 'mastercard',
        'amex', 'paypal', 'discover', 'maestro', 'elo', 'javascript:', 'mailto:', 'tel:',
        '/paymentAccepted', '/ContactPoint'
      ];
      return !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
    };

    // Upload images to Bunny Storage and get CDN URLs
    console.log('📤 Uploading images to Bunny Storage...');
    try {
      let imageUrls = productData.image_urls || productData.images || [];

      // Filter out invalid URLs
      const originalCount = imageUrls.length;
      imageUrls = imageUrls.filter(isValidImageUrl);
      if (imageUrls.length < originalCount) {
        console.log(`🔧 Filtered out ${originalCount - imageUrls.length} invalid image URLs`);
      }

      if (imageUrls.length > 0) {
        const uploadResults = await bunnyStorage.uploadImages(imageUrls, {
          width: 720,
          quality: 85,
          format: 'auto'
        });

        // Update image URLs to use CDN
        productData.image_urls = uploadResults.map(result => result.cdn);
        productData.images = uploadResults.map(result => result.cdn);

        console.log(`✅ Uploaded ${uploadResults.length} images to Bunny Storage`);
      }
    } catch (error) {
      console.error('⚠️ Bunny Storage upload failed, using original URLs:', error.message);
    }

    // Ensure all database schema fields are present with correct names
    const normalizedProduct = {
      // Primary fields matching database schema
      product_name: productData.product_name || productData.name || productData.title || '',
      brand: productData.brand || 'Unknown Brand',
      original_price: productData.original_price || productData.originalPrice || productData.price || 0,
      sale_price: productData.sale_price || productData.price || 0,
      is_on_sale: productData.is_on_sale || productData.isOnSale || productData.onSale || false,
      discount_percentage: productData.discount_percentage || productData.discountPercentage || productData.discount || null,
      sale_badge: productData.sale_badge || productData.saleBadge || null,
      image_urls: productData.image_urls || productData.images || [],
      vendor_url: url, // Always use the requested URL
      description: productData.description || '',
      // Handle both singular and plural forms for color and material
      color: productData.color || (Array.isArray(productData.colors) ? productData.colors[0] : '') || '',
      category: productData.category || '',
      material: productData.material || (Array.isArray(productData.materials) ? productData.materials.join(', ') : '') || '',
      platform: productData.platform || '',

      // Currency field - prices are stored in their original currency
      currency: productData.currency || 'USD',
      
      // Legacy fields for backward compatibility
      name: productData.product_name || productData.name || '',
      price: productData.sale_price || productData.price || 0,
      images: productData.image_urls || productData.images || [],
      originalPrice: productData.original_price || productData.originalPrice || 0,
      isOnSale: productData.is_on_sale || productData.isOnSale || false,
      discountPercentage: productData.discount_percentage || productData.discountPercentage || null,
      saleBadge: productData.sale_badge || productData.saleBadge || null
    };

    // Special logging for Foot Industry debugging
    if (url.includes('footindustry.com')) {
      console.log('🔍 FOOT INDUSTRY DEBUG:');
      console.log('  Original price from scraper:', productData.price);
      console.log('  Normalized sale_price:', normalizedProduct.sale_price);
      console.log('  Normalized original_price:', normalizedProduct.original_price);
      console.log('  Type of sale_price:', typeof normalizedProduct.sale_price);

      // Check if somehow the price got multiplied
      if (normalizedProduct.sale_price > 1000) {
        console.log('  ⚠️ WARNING: Price is over 1000! Possible currency conversion issue');
        console.log('  Calculated: 183 / 0.0069 =', 183 / 0.0069099186);
      }
    }

    console.log('✅ Returning normalized product data');

    // Clear the timeout since we're done
    clearTimeout(timeout);

    // Validate normalized product before returning
    if (!normalizedProduct.product_name || !normalizedProduct.image_urls || normalizedProduct.image_urls.length === 0) {
      console.warn('⚠️ Product data missing critical fields:', {
        hasName: !!normalizedProduct.product_name,
        hasImages: normalizedProduct.image_urls && normalizedProduct.image_urls.length > 0
      });
    }

    // Return in the expected format for frontend
    res.json({
      success: true,
      product: normalizedProduct
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    console.error('Stack trace:', error.stack);

    // Send Slack notification for parsing failure
    try {
      await slackNotifications.notifyParsingFailure({
        url: url,
        error: error.message || 'Unknown error',
        userEmail: req.body.userEmail || req.headers['user-email'] || 'Anonymous',
        timestamp: new Date().toISOString(),
        additionalInfo: {
          timeout: timeoutDuration,
          userAgent: req.headers['user-agent'],
          stack: process.env.NODE_ENV === 'development' ? error.stack : 'Hidden in production'
        }
      });
    } catch (notificationError) {
      console.error('Failed to send Slack notification:', notificationError);
    }

    // Clear the timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Don't send response if already sent by timeout
    if (!res.headersSent) {
      // Check if it's a timeout error
      if (error.message === 'Scraping timeout') {
        res.status(504).json({
          success: false,
          error: 'Request timeout - the site may have anti-bot protection',
          details: error.message
        });
      } else {
        // Log the full error for debugging
        console.error('Full error object:', JSON.stringify(error, null, 2));

        // Always return valid JSON with success: false
        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          // Provide minimal fallback product structure
          product: {
            product_name: '',
            brand: 'Unknown',
            original_price: 0,
            sale_price: 0,
            image_urls: [],
            images: [],
            description: error.message,
            currency: 'USD'
          }
        });
      }
    }
  }
});

// Size chart parsing endpoint
app.post('/parse-size-chart', async (req, res) => {
  console.log('📏 /parse-size-chart endpoint hit');
  try {
    const { url, timeout } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }
    
    console.log('📏 Parsing size chart for URL:', url);
    console.log('📏 Parsing started at:', new Date().toISOString());
    
    // Parse size chart with optional timeout
    const sizeChartData = await sizeChartParser.parseSizeChart(url, timeout);
    
    const sizeChartImage = sizeChartData?.image_url || sizeChartData?.imageUrl;
    console.log('📏 Size chart result:', {
      found: !!sizeChartData,
      type: sizeChartData?.type || 'none',
      hasData: !!(sizeChartData?.headers || sizeChartData?.rows || sizeChartData?.data || sizeChartImage)
    });
    
    if (!sizeChartData) {
      return res.json({
        success: false,
        error: 'Unable to extract size chart',
        sizeChart: {
          type: 'modal',
          requiresInteraction: true
        }
      });
    }
    
    res.json({
      success: true,
      sizeChart: sizeChartData
    });
    
  } catch (error) {
    console.error('Size chart parsing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse size chart'
    });
  }
});

// Cache management endpoint
app.post('/cache/clear', async (req, res) => {
  try {
    const { url, pattern } = req.body;

    // Check for API key in production
    if (process.env.NODE_ENV === 'production') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== process.env.CACHE_CLEAR_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const { getCache } = require('./cache/redis-cache');
    const cache = getCache();

    if (url) {
      // Clear specific URL
      await cache.delete(url);

      // Also clear V3 parser cache if it exists
      if (universalParser && universalParser.cache) {
        universalParser.cache.delete(url);
      }

      return res.json({
        success: true,
        message: `Cache cleared for URL: ${url}`
      });
    } else if (pattern) {
      // Clear by pattern (e.g., "*speedyromeo*")
      const keys = await cache.keys(pattern);
      for (const key of keys) {
        await cache.delete(key);
      }

      return res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
        keysCleared: keys.length
      });
    } else {
      // Clear all cache
      await cache.clear();

      // Also clear V3 parser memory cache
      if (universalParser && universalParser.cache) {
        universalParser.cache.clear();
      }

      return res.json({
        success: true,
        message: 'All cache cleared'
      });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

// Handle preflight requests
app.options('*', cors(corsOptions));

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await sizeChartParser.cleanup();
  process.exit(0);
});

// ============================================
// MONITORING DASHBOARD ENDPOINTS
// ============================================

// Parser performance dashboard
app.get('/api/parser/dashboard', async (req, res) => {
  try {
    const UniversalParserV2 = require('./universal-parser-v2');
    const { getMetricsCollector } = require('./monitoring/metrics-collector');
    const { getUniversalConfig } = require('./config/universal-config');

    const v2Parser = new UniversalParserV2();
    const metricsCollector = getMetricsCollector();
    const config = getUniversalConfig();

    // Get V2 metrics
    const v2Metrics = v2Parser.getMetrics ? v2Parser.getMetrics() : v2Parser.metrics;

    // Get collector metrics
    const collectorMetrics = await metricsCollector.getMetrics();

    // Get configuration status
    const configStatus = config.getStatus();

    // Calculate performance comparison
    const comparison = {
      successRate: {
        v1: collectorMetrics.v1?.successRate || 0,
        v2: (v2Metrics.successes / (v2Metrics.attempts || 1)) * 100,
        improvement: null
      },
      avgConfidence: {
        v1: collectorMetrics.v1?.avgConfidence || 0,
        v2: collectorMetrics.v2?.avgConfidence || 0,
        improvement: null
      },
      strategyBreakdown: v2Metrics.byStrategy
    };

    // Calculate improvements
    if (comparison.successRate.v1 > 0) {
      comparison.successRate.improvement =
        ((comparison.successRate.v2 - comparison.successRate.v1) / comparison.successRate.v1) * 100;
    }

    if (comparison.avgConfidence.v1 > 0) {
      comparison.avgConfidence.improvement =
        comparison.avgConfidence.v2 - comparison.avgConfidence.v1;
    }

    // Generate recommendations
    const recommendations = [];

    if (comparison.successRate.v2 > 80 && configStatus.mode === 'shadow') {
      recommendations.push({
        action: 'PROMOTE_TO_PARTIAL',
        reason: 'V2 parser showing 80%+ success rate',
        command: 'node universal-manager.js mode partial'
      });
    }

    if (v2Metrics.byStrategy.puppeteer.attempts > v2Metrics.byStrategy.direct.attempts) {
      recommendations.push({
        action: 'OPTIMIZE_PROXY',
        reason: 'High Puppeteer usage indicates many sites blocking direct access',
        sites: ['cos.com', 'hm.com', 'aritzia.com']
      });
    }

    const dashboard = {
      timestamp: new Date().toISOString(),
      mode: configStatus.mode,
      v2Parser: {
        ...v2Metrics,
        successRate: (v2Metrics.successes / (v2Metrics.attempts || 1)) * 100
      },
      comparison,
      recommendations,
      config: {
        mode: configStatus.mode,
        enabledSites: configStatus.enabled_sites,
        confidenceThreshold: configStatus.confidence_threshold
      }
    };

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate dashboard',
      message: error.message
    });
  }
});

// A/B Testing endpoint
app.get('/api/parser/abtest', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const { scrapeProduct } = require('./scrapers');

    // Run V1 parser
    process.env.USE_PARSER_V2 = 'false';
    const v1Start = Date.now();
    const v1Result = await scrapeProduct(url);
    const v1Time = Date.now() - v1Start;

    // Run V2 parser
    process.env.USE_PARSER_V2 = 'true';
    const v2Start = Date.now();
    const v2Result = await scrapeProduct(url);
    const v2Time = Date.now() - v2Start;

    res.json({
      url,
      v1: {
        success: v1Result.success,
        confidence: v1Result.confidence || 0,
        time: v1Time,
        hasData: !!(v1Result.product?.product_name && v1Result.product?.sale_price)
      },
      v2: {
        success: v2Result.success,
        confidence: v2Result.confidence || 0,
        time: v2Time,
        hasData: !!(v2Result.product?.product_name && v2Result.product?.sale_price)
      },
      winner: v2Result.confidence > v1Result.confidence ? 'V2' : 'V1'
    });
  } catch (error) {
    res.status(500).json({
      error: 'A/B test failed',
      message: error.message
    });
  }
});

// Quality Gate metrics endpoint
app.get('/api/quality-gate/metrics', (req, res) => {
  try {
    const { getQualityGate } = require('./utils/qualityGate');
    const qualityGate = getQualityGate();
    const metrics = qualityGate.getMetrics();

    res.json({
      status: 'success',
      message: 'Quality Gate validation is replacing confidence scores',
      metrics: {
        ...metrics,
        migration: {
          phase: 'Phase 1 - Quality Gate Active',
          oldSystem: 'Confidence scores (0.5, 0.7 thresholds)',
          newSystem: 'Hard pass/fail validation with JSON Schema',
          benefits: [
            'Deterministic validation instead of fuzzy scoring',
            'Clear error messages for failures',
            'Business rule enforcement',
            'No more guessing with confidence thresholds'
          ]
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Quality Gate test endpoint - test validation on any URL
app.post('/api/quality-gate/test', async (req, res) => {
  try {
    const { product } = req.body;

    if (!product) {
      return res.status(400).json({
        error: 'Product data required in request body'
      });
    }

    const { getQualityGate } = require('./utils/qualityGate');
    const qualityGate = getQualityGate();
    const validation = qualityGate.validate(product);

    res.json({
      input: product,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

// Lean Parser metrics endpoints
app.get('/api/lean-parser/metrics', (req, res) => {
  if (PARSER_VERSION !== 'lean') {
    return res.status(400).json({
      error: 'Lean parser not active',
      current_version: PARSER_VERSION,
      hint: 'Set PARSER_VERSION=lean to enable'
    });
  }

  try {
    const metrics = universalParser.getMetrics();
    res.json({
      status: 'success',
      parser: 'LEAN v4.0.0',
      metrics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

// Render policy stats
app.get('/api/render-policy/stats', (req, res) => {
  try {
    const { getRenderPolicy } = require('./utils/renderPolicy');
    const policy = getRenderPolicy();
    const stats = policy.getStats();

    res.json({
      status: 'success',
      stats,
      message: 'Smart rendering policy active'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get render policy stats',
      message: error.message
    });
  }
});

// Circuit breaker status
app.get('/api/circuit-breaker/status', (req, res) => {
  try {
    const { getCircuitBreaker } = require('./utils/circuitBreaker');
    const breaker = getCircuitBreaker();
    const metrics = breaker.getMetrics();
    const statuses = breaker.getAllStatuses();

    res.json({
      status: 'success',
      metrics,
      circuits: statuses
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get circuit breaker status',
      message: error.message
    });
  }
});

// Parser version endpoint
app.get('/api/parser/version', (req, res) => {
  res.json({
    current: PARSER_VERSION,
    available: ['v3', 'lean'],
    lean_status: PARSER_VERSION === 'lean' ? 'active' : 'available',
    features: {
      v3: ['confidence scores', 'auto-learning', 'pattern-db'],
      lean: ['quality gate', 'plugins', 'recipes', 'circuit breakers', 'smart rendering']
    },
    migration: {
      status: PARSER_VERSION === 'lean' ? 'completed' : 'ready',
      recommendation: PARSER_VERSION !== 'lean' ? 'Set PARSER_VERSION=lean to enable lean parser' : 'Already using lean parser'
    }
  });
});

// Rollout status endpoint
app.get('/api/rollout/status', (req, res) => {
  const metrics = rolloutConfig.getMetrics();
  res.json({
    status: 'success',
    rollout: metrics,
    parsers: {
      v3: v3Parser ? 'initialized' : 'not available',
      lean: leanParser ? 'initialized' : 'not available'
    },
    timestamp: new Date().toISOString()
  });
});

// Rollout metrics endpoint
app.get('/api/rollout/metrics', (req, res) => {
  const metrics = rolloutConfig.getMetrics();
  res.json({
    ...metrics,
    timestamp: new Date().toISOString()
  });
});

// Update rollout configuration endpoint
app.post('/api/rollout/config', (req, res) => {
  const { mode, percentage, addDomain, removeDomain } = req.body;

  // Check for admin key in production
  if (process.env.NODE_ENV === 'production') {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }
  }

  try {
    if (mode) {
      rolloutConfig.mode = mode;
      console.log(`📊 Rollout mode changed to: ${mode}`);
    }

    if (percentage !== undefined) {
      rolloutConfig.leanParserPercentage = parseInt(percentage);
      console.log(`📊 Lean parser percentage changed to: ${percentage}%`);
    }

    if (addDomain) {
      rolloutConfig.addTrustedDomain(addDomain);
    }

    if (removeDomain) {
      rolloutConfig.removeTrustedDomain(removeDomain);
    }

    res.json({
      success: true,
      config: {
        mode: rolloutConfig.mode,
        percentage: rolloutConfig.leanParserPercentage,
        trustedDomains: Array.from(rolloutConfig.trustedDomains)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset rollout metrics
app.post('/api/rollout/reset', (req, res) => {
  // Check for admin key in production
  if (process.env.NODE_ENV === 'production') {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }
  }

  rolloutConfig.resetMetrics();
  res.json({
    success: true,
    message: 'Rollout metrics reset',
    timestamp: new Date().toISOString()
  });
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await sizeChartParser.cleanup();

  // Cleanup lean parser if active
  if (PARSER_VERSION === 'lean' && universalParser && universalParser.cleanup) {
    await universalParser.cleanup();
  }

  process.exit(0);
});

// Listen on all interfaces for Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MMMMood Parser API running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'https://www.mmmmood.com'}`);

  // Start background worker if Supabase is configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    console.log('🔄 Starting background job worker...');
    require('./worker');
  } else {
    console.log('⚠️ Background worker not started - Supabase credentials missing');
  }
});
