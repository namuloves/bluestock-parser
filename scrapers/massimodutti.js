const axios = require('axios');
const cheerio = require('cheerio');
const { scrapeWithApifyPuppeteer } = require('./apify-puppeteer');

async function scrapeMassimoDuttiFallback(url) {
  console.log('📱 Using fallback data for Massimo Dutti');
  
  // Extract product info from URL if possible
  const urlParts = url.split('/');
  const productSlug = urlParts[urlParts.length - 1] || 'product';
  const productName = productSlug
    .replace(/-l\d+$/, '') // Remove product ID
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  return {
    name: productName || 'Massimo Dutti Product',
    brand: 'Massimo Dutti',
    price: 0,
    originalPrice: 0,
    isOnSale: false,
    images: [],
    url,
    description: 'Visit Massimo Dutti website for full product details',
    color: '',
    sizes: [],
    materials: [],
    inStock: true,
    platform: 'massimodutti',
    error: 'Bot protection detected. Please visit the website directly for current pricing and availability.'
  };
}

async function scrapeMassimoDutti(url) {
  console.log('🛍️ Scraping Massimo Dutti:', url);
  
  // First try direct scraping (will likely fail due to bot protection)
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(response.data);
    
    // Try to extract basic product data
    const name = $('h1.product-detail-info__product-name').text().trim() ||
                 $('[data-testid="product-name"]').text().trim() ||
                 $('h1').first().text().trim();
    
    if (!name) {
      throw new Error('No product data found - bot protection likely active');
    }
    
    const price = $('.product-detail-info__price-now').text().trim() ||
                 $('[data-testid="product-price"]').text().trim();
    
    const originalPrice = $('.product-detail-info__price-old').text().trim() ||
                          $('[data-testid="product-original-price"]').text().trim();
    
    // Parse prices
    const parsePrice = (priceStr) => {
      if (!priceStr) return 0;
      const match = priceStr.match(/[\d,]+\.?\d*/);
      return match ? parseFloat(match[0].replace(',', '')) : 0;
    };
    
    const currentPrice = parsePrice(price);
    const origPrice = parsePrice(originalPrice) || currentPrice;
    
    return {
      name,
      brand: 'Massimo Dutti',
      price: currentPrice,
      originalPrice: origPrice,
      isOnSale: originalPrice && origPrice > currentPrice,
      images: [],
      url,
      description: $('.product-detail-info__description').text().trim() || '',
      color: $('.product-detail-info__color-name').text().trim() || '',
      sizes: [],
      materials: [],
      inStock: true,
      platform: 'massimodutti'
    };
    
  } catch (error) {
    console.log('Direct scraping failed:', error.message);
    
    // If we have Apify API key, try using it
    if (process.env.APIFY_API_TOKEN) {
      try {
        const apifyResult = await scrapeWithApifyPuppeteer(url, 'Massimo Dutti');
        
        // Process the Apify result
        if (apifyResult) {
          const parsePrice = (priceStr) => {
            if (!priceStr) return 0;
            const match = priceStr.match(/[\d,]+\.?\d*/);
            return match ? parseFloat(match[0].replace(',', '')) : 0;
          };
          
          const currentPrice = parsePrice(apifyResult.price);
          const origPrice = parsePrice(apifyResult.originalPrice) || currentPrice;
          
          return {
            name: apifyResult.name || apifyResult.title || 'Massimo Dutti Product',
            brand: apifyResult.brand || 'Massimo Dutti',
            price: currentPrice,
            originalPrice: origPrice,
            isOnSale: apifyResult.originalPrice && origPrice > currentPrice,
            images: apifyResult.images || [],
            url,
            description: apifyResult.description || '',
            color: apifyResult.color || '',
            sizes: apifyResult.sizes || [],
            materials: apifyResult.materials || [],
            inStock: apifyResult.inStock !== false,
            platform: 'massimodutti'
          };
        }
      } catch (apifyError) {
        console.error('Apify scraping also failed:', apifyError.message);
      }
    }
    
    // Fall back to basic data
    return scrapeMassimoDuttiFallback(url);
  }
}

module.exports = { scrapeMassimoDutti };