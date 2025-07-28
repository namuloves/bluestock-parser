const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeSezane(url) {
  console.log('🔍 Attempting to scrape Sezane...');
  console.warn('⚠️ Note: Sezane has strong DataDome protection. Results may be limited.');
  
  try {
    // Extract product info from URL
    const urlParts = url.split('/');
    const productSlug = urlParts[urlParts.length - 2]; // e.g., "christie-shirt"
    const colorSlug = urlParts[urlParts.length - 1]; // e.g., "ecru"
    
    // Base configuration
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.sezane.com/'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Accept 403s
    };
    
    // Get config with proxy if enabled
    const config = getAxiosConfig(url, baseConfig);
    
    // Make request
    const response = await axios.get(url, config);
    
    // Check if we're blocked
    if (response.status === 403 || response.headers['x-datadome']) {
      console.log('🚫 Blocked by DataDome protection');
      
      // Return minimal data based on URL
      const productName = productSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const color = colorSlug.charAt(0).toUpperCase() + colorSlug.slice(1);
      
      return {
        name: productName,
        price: 'Price unavailable (blocked)',
        originalPrice: null,
        images: [],
        description: 'Unable to fetch product details due to site protection. Please visit Sezane.com directly.',
        sizes: [],
        color: color,
        sku: productSlug,
        brand: 'Sézane',
        category: 'Fashion',
        isOnSale: false,
        inStock: false,
        url: url,
        error: 'DataDome protection active'
      };
    }
    
    // If we somehow get through, parse the HTML
    const $ = cheerio.load(response.data);
    
    // Look for JSON-LD
    let jsonLdData = null;
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json['@type'] === 'Product') {
          jsonLdData = json;
        }
      } catch (e) {}
    });
    
    // Try to extract basic info
    const name = jsonLdData?.name || 
                 $('h1').first().text().trim() || 
                 $('meta[property="og:title"]').attr('content') || 
                 productName;
    
    const price = jsonLdData?.offers?.price || 
                  $('.price').first().text().trim() || 
                  'Price unavailable';
    
    const image = jsonLdData?.image || 
                  $('meta[property="og:image"]').attr('content') || 
                  '';
    
    const description = jsonLdData?.description || 
                       $('meta[property="og:description"]').attr('content') || 
                       '';
    
    return {
      name: name,
      price: typeof price === 'number' ? `$${price}` : price,
      originalPrice: null,
      images: image ? [image] : [],
      description: description,
      sizes: [],
      color: color,
      sku: productSlug,
      brand: 'Sézane',
      category: 'Fashion',
      isOnSale: false,
      inStock: true,
      url: url
    };
    
  } catch (error) {
    console.error('Sezane scraper error:', error.message);
    
    // Return error data
    return {
      name: 'Sézane Product',
      price: 'Error fetching price',
      originalPrice: null,
      images: [],
      description: `Error: ${error.message}`,
      sizes: [],
      color: '',
      sku: '',
      brand: 'Sézane',
      category: 'Fashion',
      isOnSale: false,
      inStock: false,
      url: url,
      error: error.message
    };
  }
}

module.exports = { scrapeSezane };