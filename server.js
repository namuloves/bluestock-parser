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
const healthRoutes = require('./routes/health');

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

// CORS configuration - more permissive for production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://bluestock-bay.vercel.app',
      'https://bluestock.vercel.app',
      'https://bluestock-git-main.vercel.app',
      'http://localhost:3000', // For local development
      'http://localhost:3001',
      process.env.FRONTEND_URL // Dynamic frontend URL from env
    ].filter(Boolean); // Remove any undefined values

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow any Vercel deployment
    if (origin && (origin.includes('vercel.app') || origin.includes('localhost'))) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS warning - unknown origin:', origin);
      // In production, allow all origins but log them
      if (process.env.NODE_ENV === 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // Allow cookies if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check routes (before other routes)
app.use('/', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Bluestock Parser API is running!');
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

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    status: 'OK',
    service: 'bluestock-parser',
    timestamp: new Date().toISOString(),
    message: 'Parser service is running and accessible!',
    proxy: {
      USE_PROXY: process.env.USE_PROXY,
      hasDecodoUsername: !!process.env.DECODO_USERNAME,
      hasDecodoPassword: !!process.env.DECODO_PASSWORD,
      proxyEnabled: process.env.USE_PROXY === 'true' || (!!process.env.DECODO_USERNAME && !!process.env.DECODO_PASSWORD),
      note: 'Proxy auto-enables when Decodo credentials are present'
    }
  });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  console.log('📥 /scrape endpoint hit');
  
  // Check if this is a Massimo Dutti URL that needs more time
  const url = req.body.url || '';
  const needsLongerTimeout = url.includes('massimodutti.com') || 
                             url.includes('net-a-porter.com') ||
                             url.includes('ssense.com');
  
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
    
    // Use actual scraper with race condition against timeout
    const scrapePromise = scrapeProduct(url);
    // Increase timeout to 90 seconds for Apify requests
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Scraping timeout')), 90000)
    );
    
    const scrapeResult = await Promise.race([scrapePromise, timeoutPromise]);
    
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
      color: productData.color || '',
      category: productData.category || '',
      material: productData.material || '',
      platform: productData.platform || '',
      
      // Legacy fields for backward compatibility
      name: productData.product_name || productData.name || '',
      price: productData.sale_price || productData.price || 0,
      images: productData.image_urls || productData.images || [],
      originalPrice: productData.original_price || productData.originalPrice || 0,
      isOnSale: productData.is_on_sale || productData.isOnSale || false,
      discountPercentage: productData.discount_percentage || productData.discountPercentage || null,
      saleBadge: productData.sale_badge || productData.saleBadge || null
    };
    
    console.log('✅ Returning normalized product data');
    
    // Clear the timeout since we're done
    clearTimeout(timeout);
    
    // Always return the product directly, not wrapped
    res.json(normalizedProduct);
    
  } catch (error) {
    console.error('❌ Scraping error:', error);
    console.error('Stack trace:', error.stack);
    
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
        
        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
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
    
    console.log('📏 Size chart result:', {
      found: !!sizeChartData,
      type: sizeChartData?.type || 'none',
      hasData: !!(sizeChartData?.headers || sizeChartData?.rows || sizeChartData?.data || sizeChartData?.image_url)
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

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await sizeChartParser.cleanup();
  process.exit(0);
});

// Listen on all interfaces for Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bluestock Parser API running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'https://bluestock-bay.vercel.app'}`);
});