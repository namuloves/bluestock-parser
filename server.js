const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'bluestock-parser' });
});

app.get('/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'bluestock-parser',
    timestamp: new Date().toISOString(),
    message: 'Parser service is running and accessible!'
  });
});

app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    // TODO: Implement actual scraping logic
    const mockProduct = {
      product_name: 'Sample Product',
      brand: 'Sample Brand',
      original_price: 99.99,
      sale_price: 79.99,
      is_on_sale: true,
      discount_percentage: 20,
      sale_badge: '20% OFF',
      image_urls: ['https://example.com/image1.jpg'],
      description: 'Product description will be scraped here',
      color: 'Black',
      category: 'Electronics',
      material: 'Plastic',
      // Backward compatibility
      name: 'Sample Product',
      price: 79.99,
      images: ['https://example.com/image1.jpg']
    };
    
    res.json({ 
      success: true,
      product: mockProduct
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Bluestock Parser API running on port ${PORT}`);
});