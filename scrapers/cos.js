const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeCOSHTML(url) {
  try {
    console.log('🔍 Fetching COS page directly...');
    
    // Base configuration
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    };
    
    // Get config with proxy if enabled
    const config = getAxiosConfig(url, baseConfig);
    
    // Make request
    const response = await axios.get(url, config);
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract from JSON-LD structured data
    let productData = null;
    let jsonLdData = null;
    
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        
        // Look for Product type
        if (json['@type'] === 'Product') {
          jsonLdData = json;
        }
        // Sometimes it's nested in @graph
        else if (json['@graph']) {
          const product = json['@graph'].find(item => item['@type'] === 'Product');
          if (product) {
            jsonLdData = product;
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e.message);
      }
    });
    
    if (jsonLdData) {
      // Extract images
      const images = [];
      if (jsonLdData.image) {
        if (Array.isArray(jsonLdData.image)) {
          images.push(...jsonLdData.image);
        } else if (typeof jsonLdData.image === 'string') {
          images.push(jsonLdData.image);
        } else if (jsonLdData.image.url) {
          images.push(jsonLdData.image.url);
        }
      }
      
      // Extract sizes from offers (different SKUs usually mean different sizes)
      const sizes = [];
      const offers = Array.isArray(jsonLdData.offers) ? jsonLdData.offers : (jsonLdData.offers ? [jsonLdData.offers] : []);

      // Get price from first available offer
      let price = 0;
      let currency = 'USD';
      let inStock = false;

      if (offers.length > 0) {
        // Get price from first offer
        const firstOffer = offers[0];
        if (firstOffer.price) {
          price = firstOffer.price;
          currency = firstOffer.priceCurrency || 'USD';
        }
        // Check if any offer is in stock
        offers.forEach(offer => {
          if (offer.availability?.includes('InStock')) {
            inStock = true;
          }
        });
      }
      
      // Try to extract color from name or description
      const name = jsonLdData.name || '';
      const description = jsonLdData.description || '';
      let color = '';
      
      // Common color words to look for
      const colorWords = ['black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'brown', 'grey', 'gray', 'beige', 'navy', 'cream'];
      const nameLower = name.toLowerCase();
      const descLower = description.toLowerCase();
      
      for (const colorWord of colorWords) {
        if (nameLower.includes(colorWord) || descLower.includes(colorWord)) {
          color = colorWord.charAt(0).toUpperCase() + colorWord.slice(1);
          break;
        }
      }
      
      // Also try to get color from title after dash
      const colorMatch = name.match(/[-–]\s*(.+)$/);
      if (colorMatch) {
        color = colorMatch[1].trim();
      }
      
      // Build the final product object
      productData = {
        name: name,
        price: price, // Return numeric price, not formatted string
        originalPrice: null,
        images: images,
        description: description,
        sizes: sizes,
        color: color,
        sku: jsonLdData.sku || '',
        brand: jsonLdData.brand?.name || 'COS',
        category: '',
        isOnSale: false,
        inStock: inStock,
        url: url,
        currency: currency
      };
    }
    
    // Fallback to HTML parsing if no JSON-LD
    if (!productData) {
      const name = $('h1').first().text().trim() || 
                   $('.product-name').text().trim() ||
                   $('meta[property="og:title"]').attr('content') || '';
      
      const priceText = $('.price').first().text().trim() || 
                        $('.product-price').text().trim() ||
                        '';
      
      const images = [];
      $('meta[property="og:image"]').each((i, elem) => {
        const src = $(elem).attr('content');
        if (src) images.push(src);
      });
      
      productData = {
        name: name,
        price: priceText || 'Price not available',
        originalPrice: null,
        images: images,
        description: $('meta[property="og:description"]').attr('content') || '',
        sizes: [],
        color: '',
        sku: url.match(/(\d+)$/)?.[1] || '',
        brand: 'COS',
        category: '',
        isOnSale: false,
        inStock: true,
        url: url
      };
    }
    
    return productData;
    
  } catch (error) {
    console.error('COS HTML scraper error:', error.message);
    
    // If it's a 403 or similar, we might be blocked
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      if (error.response.status === 403) {
        // Return minimal data instead of throwing
        return {
          name: 'COS Product',
          price: 'Price unavailable (blocked)',
          originalPrice: null,
          images: [],
          description: 'Unable to fetch product details due to site protection',
          sizes: [],
          color: '',
          sku: url.match(/(\d+)$/)?.[1] || '',
          brand: 'COS',
          category: 'Fashion',
          isOnSale: false,
          inStock: false,
          url: url,
          error: `Blocked: ${error.response.status}`
        };
      }
    }
    
    throw error;
  }
}

module.exports = { scrapeCOS: scrapeCOSHTML };