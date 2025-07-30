const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');
const { scrapeNordstromWithPuppeteer } = require('./nordstrom-puppeteer');

async function scrapeNordstromHTML(url) {
  try {
    console.log('🔍 Fetching Nordstrom page directly...');
    
    // Base configuration
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Referer': 'https://www.nordstrom.com/'
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
    
    // Also try to extract from __INITIAL_CONFIG__ script
    let initialConfig = null;
    $('script:not([src])').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent.includes('window.__INITIAL_CONFIG__')) {
        const configMatch = scriptContent.match(/window\.__INITIAL_CONFIG__\s*=\s*({[\s\S]*?});/);
        if (configMatch) {
          try {
            initialConfig = JSON.parse(configMatch[1]);
          } catch (e) {
            console.error('Failed to parse __INITIAL_CONFIG__:', e.message);
          }
        }
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
      
      // Extract sizes from offers
      const sizes = [];
      const offers = Array.isArray(jsonLdData.offers) ? jsonLdData.offers : [jsonLdData.offers].filter(Boolean);
      
      // Get price from offers
      let price = 0;
      let originalPrice = null;
      let currency = 'USD';
      let inStock = false;
      
      offers.forEach(offer => {
        if (offer.price && !price) {
          price = offer.price;
          currency = offer.priceCurrency || 'USD';
        }
        if (offer.highPrice && offer.highPrice > price) {
          originalPrice = offer.highPrice;
        }
        if (offer.availability?.includes('InStock')) {
          inStock = true;
        }
      });
      
      // Extract color from name or description
      const name = jsonLdData.name || '';
      const description = jsonLdData.description || '';
      let color = '';
      
      // Try to get color from variations
      if (jsonLdData.color) {
        color = jsonLdData.color;
      } else {
        // Try to extract from product name (often format: "Product Name in Color")
        const colorMatch = name.match(/\bin\s+([A-Za-z\s]+)$/i);
        if (colorMatch) {
          color = colorMatch[1].trim();
        }
      }
      
      // Build the final product object
      productData = {
        name: name,
        price: currency === 'USD' ? `$${price}` : `${price} ${currency}`,
        originalPrice: originalPrice ? (currency === 'USD' ? `$${originalPrice}` : `${originalPrice} ${currency}`) : null,
        images: images,
        description: description,
        sizes: sizes,
        color: color,
        sku: jsonLdData.sku || '',
        brand: jsonLdData.brand?.name || '',
        category: jsonLdData.category || '',
        isOnSale: !!originalPrice && originalPrice > price,
        inStock: inStock,
        url: url
      };
    }
    
    // Fallback to HTML parsing if no JSON-LD
    if (!productData) {
      console.log('⚠️ No JSON-LD found, using HTML extraction');
      
      // Extract product name
      const name = $('h1').first().text().trim() || 
                   $('.product-title').text().trim() ||
                   $('[data-element="product-title"]').text().trim() ||
                   $('meta[property="og:title"]').attr('content') || '';
      
      // Extract price
      const priceText = $('.price-display-item').first().text().trim() || 
                        $('[aria-label*="Price"]').first().text().trim() ||
                        $('.product-price').text().trim() ||
                        '';
      
      const originalPriceText = $('.price-display-item--original').text().trim() ||
                                $('[aria-label*="Original"]').text().trim() ||
                                '';
      
      // Extract images
      const images = [];
      
      // Try og:image
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) images.push(ogImage);
      
      // Look for product images
      $('img').each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src && src.includes('nordstromimage.com') && !src.includes('icon')) {
          // Convert to high resolution
          const highResSrc = src.replace(/w=\d+/, 'w=1200').replace(/h=\d+/, 'h=1600');
          if (!images.includes(highResSrc)) {
            images.push(highResSrc);
          }
        }
      });
      
      // Extract sizes
      const sizes = [];
      $('[aria-label*="size"]').each((i, elem) => {
        const size = $(elem).text().trim();
        if (size && !$(elem).attr('disabled') && !$(elem).hasClass('disabled')) {
          sizes.push(size);
        }
      });
      
      // Extract color
      const color = $('[aria-label*="Color"]').first().text().trim() ||
                    $('.selected-color-name').text().trim() ||
                    '';
      
      // Extract brand
      const brand = $('.product-brand').text().trim() ||
                    $('[data-element="product-brand"]').text().trim() ||
                    '';
      
      productData = {
        name: name,
        price: priceText || 'Price not available',
        originalPrice: originalPriceText || null,
        images: images.slice(0, 10),
        description: $('meta[property="og:description"]').attr('content') || '',
        sizes: sizes,
        color: color,
        sku: url.match(/\/(\d+)$/)?.[1] || '',
        brand: brand || 'Nordstrom',
        category: '',
        isOnSale: !!originalPriceText,
        inStock: !$('.out-of-stock').length,
        url: url
      };
    }
    
    return productData;
    
  } catch (error) {
    console.error('Nordstrom HTML scraper error:', error.message);
    
    // If it's a 403 or similar, we might be blocked
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      if (error.response.status === 403 || error.response.status === 429) {
        // Return minimal data instead of throwing
        return {
          name: 'Nordstrom Product',
          price: 'Price unavailable (blocked)',
          originalPrice: null,
          images: [],
          description: 'Unable to fetch product details due to site protection',
          sizes: [],
          color: '',
          sku: url.match(/\/(\d+)$/)?.[1] || '',
          brand: 'Nordstrom',
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

// Main scraper function that tries Puppeteer first, then falls back to HTML
async function scrapeNordstrom(url) {
  // Disable Puppeteer for now to prevent crashes
  const isPuppeteerAvailable = false; // process.env.ENABLE_PUPPETEER === 'true';
  
  console.log(`🔍 Nordstrom scraper - Puppeteer available: ${isPuppeteerAvailable}`);
  console.log(`🔍 Environment: ${process.env.NODE_ENV}, ENABLE_PUPPETEER: ${process.env.ENABLE_PUPPETEER}`);
  
  try {
    if (isPuppeteerAvailable) {
      // Try Puppeteer first for better results
      console.log('🚀 Attempting Puppeteer scraping for Nordstrom...');
      
      try {
        const puppeteerResult = await scrapeNordstromWithPuppeteer(url);
        
        // If we got good data from Puppeteer, return it
        if (puppeteerResult.name && puppeteerResult.name !== 'Nordstrom Product') {
          console.log('✅ Puppeteer scraping successful');
          return puppeteerResult;
        }
      } catch (puppeteerError) {
        console.error('⚠️ Puppeteer failed:', puppeteerError.message);
        console.log('⚠️ Falling back to HTML scraping...');
      }
    } else {
      console.log('⚠️ Puppeteer disabled in production, using HTML scraping');
    }
    
    // Otherwise, fall back to HTML scraping
    console.log('⚠️ Puppeteer didn\'t get full data, trying HTML scraping...');
    return await scrapeNordstromHTML(url);
    
  } catch (error) {
    console.error('Nordstrom scraper error:', error.message);
    
    // Try HTML scraping as final fallback
    try {
      return await scrapeNordstromHTML(url);
    } catch (htmlError) {
      // Return minimal data if all methods fail
      return {
        name: 'Nordstrom Product',
        price: 'Price unavailable',
        originalPrice: null,
        images: [],
        description: 'Unable to fetch product details',
        sizes: [],
        color: '',
        sku: url.match(/\/(\d+)$/)?.[1] || '',
        brand: 'Nordstrom',
        category: 'Fashion',
        isOnSale: false,
        inStock: false,
        url: url,
        error: `All methods failed: ${error.message}`
      };
    }
  }
}

module.exports = { scrapeNordstrom };