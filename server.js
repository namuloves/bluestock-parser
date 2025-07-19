const express = require('express');
const cors = require('cors');
const { scrapeProduct } = require('./scrapers');

const app = express();
const PORT = process.env.PORT || 3001;

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
    message: 'Parser service is running and accessible!'
  });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }
    
    console.log('🔍 Scraping URL:', url);
    
    // Use actual scraper
    const scrapeResult = await scrapeProduct(url);
    
    // If scraping failed, return the error
    if (!scrapeResult.success) {
      return res.status(400).json(scrapeResult);
    }
    
    // Extract product data from scrape result
    const productData = scrapeResult.product || {};
    
    // Ensure all database schema fields are present with correct names
    const normalizedProduct = {
      // Primary fields matching database schema
      product_name: productData.product_name || productData.name || '',
      brand: productData.brand || 'Unknown Brand',
      original_price: productData.original_price || productData.originalPrice || productData.price || 0,
      sale_price: productData.sale_price || productData.price || 0,
      is_on_sale: productData.is_on_sale || productData.isOnSale || false,
      discount_percentage: productData.discount_percentage || productData.discountPercentage || null,
      sale_badge: productData.sale_badge || productData.saleBadge || null,
      image_urls: productData.image_urls || productData.images || [],
      vendor_url: url, // Always use the requested URL
      description: productData.description || '',
      color: productData.color || '',
      category: productData.category || '',
      material: productData.material || '',
      
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

app.listen(PORT, () => {
  console.log(`Bluestock Parser API running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'https://bluestock-bay.vercel.app'}`);
});