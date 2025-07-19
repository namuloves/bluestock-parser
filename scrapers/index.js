const { scrapeAmazonProduct } = require('./amazon');
const { scrapeGarmentory } = require('./garmentory');

// Site detection function
const detectSite = (url) => {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('amazon.')) {
    return 'amazon';
  }
  if (hostname.includes('farfetch.')) {
    return 'farfetch';
  }
  if (hostname.includes('etsy.')) {
    return 'etsy';
  }
  if (hostname.includes('garmentory.')) {
    return 'garmentory';
  }
  
  return 'generic';
};

// Main scraping function with site routing
const scrapeProduct = async (url) => {
  console.log('🔍 Detecting site for:', url);
  
  const site = detectSite(url);
  console.log('🏷️ Detected site:', site);
  
  try {
    switch (site) {
      case 'amazon':
        console.log('🛒 Using Amazon scraper');
        return await scrapeAmazonProduct(url);
        
      case 'garmentory':
        console.log('👗 Using Garmentory scraper');
        return await scrapeGarmentory(url);
        
      case 'farfetch':
        console.log('👗 Farfetch scraper not implemented yet');
        return {
          success: false,
          error: 'Farfetch scraper coming soon'
        };
        
      case 'etsy':
        console.log('🎨 Etsy scraper not implemented yet');
        return {
          success: false,
          error: 'Etsy scraper coming soon'
        };
        
      default:
        console.log('🔧 Using generic scraper (mock data)');
        return {
          success: true,
          product: {
            product_name: "Sample Product",
            brand: "Sample Brand",
            original_price: 99.99,
            sale_price: 79.99,
            is_on_sale: true,
            discount_percentage: 20,
            sale_badge: "20% OFF",
            image_urls: ["https://example.com/image1.jpg"],
            description: "Product description will be scraped here",
            color: "Black",
            category: "Electronics",
            material: "Plastic",
            // Consistent naming for main app
            name: "Sample Product",
            images: ["https://example.com/image1.jpg"],
            price: 79.99,
            originalPrice: 99.99,
            isOnSale: true,
            saleBadge: "20% OFF"
          }
        };
    }
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    return {
      success: false,
      error: `Scraping failed: ${error.message}`
    };
  }
};

module.exports = {
  scrapeProduct,
  detectSite
};