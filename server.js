const express = require('express');
const cors = require('cors');
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { scrapeProduct } = require('./scrapers');
const { enhanceWithAI } = require('./scrapers/ebay');
const ClaudeAIService = require('./services/claude-ai');

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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://bluestock-bay.vercel.app',
      'http://localhost:3000', // For local development
      'http://localhost:3001',
      process.env.FRONTEND_URL // Dynamic frontend URL from env
    ].filter(Boolean); // Remove any undefined values

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('Bluestock Parser API is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'bluestock-parser' });
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
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }
    
    console.log('🔍 Scraping URL:', url);
    console.log('🔍 Scraping started at:', new Date().toISOString());
    
    // Use actual scraper
    const scrapeResult = await scrapeProduct(url);
    
    console.log('🔍 Scrape result:', {
      success: scrapeResult.success,
      hasProduct: !!scrapeResult.product,
      productName: scrapeResult.product?.name || scrapeResult.product?.product_name || 'No name',
      error: scrapeResult.error
    });
    
    // If scraping failed, return the error
    if (!scrapeResult.success) {
      return res.status(400).json(scrapeResult);
    }
    
    // Extract product data from scrape result
    let productData = scrapeResult.product || {};
    
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
      description: productData.description,
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
    
    res.json({
      success: true,
      product: normalizedProduct
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Handle preflight requests
app.options('*', cors(corsOptions));

// Listen on all interfaces for Railway
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bluestock Parser API running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'https://bluestock-bay.vercel.app'}`);
});