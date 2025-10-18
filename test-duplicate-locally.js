const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Mock duplicate database
const mockDuplicates = {
  'https://www.speedyromeo.com/store/product/provel-powered-speedys-shirt-2025/': {
    originalUrl: 'https://www.speedyromeo.com/store/product/provel-powered-speedys-shirt-2025/',
    firstSaved: '2025-09-25T20:00:00.000Z',
    lastSaved: '2025-09-26T10:30:00.000Z',
    saveCount: 3,
    productData: {
      name: 'Provel Powered Speedys Shirt 2025',
      brand: 'Speedy Romeo',
      price: 35,
      imageUrl: 'https://www.speedyromeo.com/some-image.jpg'
    },
    savedBy: [
      { userId: 'user123', timestamp: '2025-09-25T20:00:00.000Z' },
      { userId: 'user456', timestamp: '2025-09-26T08:15:00.000Z' },
      { userId: 'user789', timestamp: '2025-09-26T10:30:00.000Z' }
    ]
  }
};

// Duplicate check endpoint
app.post('/api/check-duplicate', (req, res) => {
  console.log('📥 Received duplicate check for:', req.body.url);

  const { url } = req.body;

  console.log('Raw URL received:', url);
  console.log('URL includes speedyromeo?', url.toLowerCase().includes('speedyromeo'));

  // Only return duplicate if it's actually the Speedy Romeo URL
  const isDuplicate = url && url.toLowerCase().includes('speedyromeo')

  if (isDuplicate) {
    const data = Object.values(mockDuplicates)[0]; // Get first match
    console.log('⚠️ URL is duplicate!');
    res.json({
      isDuplicate: true,
      data: data,
      message: `This product has been saved ${data.saveCount} times`
    });
  } else {
    console.log('✅ URL is not duplicate');
    res.json({
      isDuplicate: false,
      message: 'This is a new product URL'
    });
  }
});

// Save URL endpoint
app.post('/api/save-url', (req, res) => {
  console.log('💾 Saving URL:', req.body.url);
  res.json({
    success: true,
    message: 'URL saved successfully'
  });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`🚀 Test duplicate server running on http://localhost:${PORT}`);
  console.log(`\n📝 To test duplicate detection:`);
  console.log(`1. Server is now running!`);
  console.log(`2. Make sure your .env.local has:`);
  console.log(`   NEXT_PUBLIC_SCRAPER_SERVICE_URL=http://localhost:${PORT}`);
  console.log(`3. Try saving this URL in the UI:`);
  console.log(`   https://www.speedyromeo.com/store/product/provel-powered-speedys-shirt-2025/`);
  console.log(`\nYou should see the duplicate modal appear! 🎉`);
});