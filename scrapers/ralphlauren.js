const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeRalphLaurenHTML(url) {
  try {
    console.log('🔍 Fetching Ralph Lauren page directly...');
    
    // Base configuration
    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.ralphlauren.com/'
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
    
    // Extract from digitalData JavaScript object
    let productData = null;
    $('script:not([src])').each((i, elem) => {
      const scriptContent = $(elem).html();
      const digitalDataMatch = scriptContent.match(/digitalData\s*=\s*({[\s\S]*?});/);
      
      if (digitalDataMatch) {
        try {
          const digitalData = JSON.parse(digitalDataMatch[1]);
          if (digitalData.product && digitalData.product.item && digitalData.product.item[0]) {
            productData = digitalData.product.item[0];
          }
        } catch (e) {
          console.error('Failed to parse digitalData:', e.message);
        }
      }
    });
    
    // Also try meta tags as fallback
    const metaData = {
      name: $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim(),
      image: $('meta[property="og:image"]').attr('content'),
      price: $('.price-sales').first().text().trim() || $('.product-price').first().text().trim()
    };
    
    // Extract images from the page
    const images = [];
    
    // Try og:image first
    if (metaData.image) {
      images.push(metaData.image);
    }
    
    // Look for product images
    $('img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src && src.includes('ralphlauren') && (src.includes('lifestyle') || src.includes('product'))) {
        // Convert to high resolution
        const highResSrc = src.replace(/wid=\d+/, 'wid=1200').replace(/hei=\d+/, 'hei=1200');
        if (!images.includes(highResSrc)) {
          images.push(highResSrc);
        }
      }
    });
    
    // Look for picture elements with srcset
    $('picture source').each((i, elem) => {
      const srcset = $(elem).attr('srcset');
      if (srcset && srcset.includes('ralphlauren')) {
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (!images.includes(url)) {
            images.push(url);
          }
        });
      }
    });
    
    // Extract size options
    const sizes = [];
    $('.swatches.size button, .size-selector button, button[aria-label*="size"]').each((i, elem) => {
      const size = $(elem).text().trim() || $(elem).attr('aria-label');
      if (size && !$(elem).attr('disabled')) {
        sizes.push(size);
      }
    });
    
    // Extract color
    const color = $('.selected-color').text().trim() || 
                  $('[data-testid="selected-color"]').text().trim() ||
                  $('.color-name').text().trim() ||
                  '';
    
    // Build the final product object
    if (productData) {
      console.log('✅ Found digitalData product info');
      return {
        name: productData.productName || metaData.name,
        price: `$${productData.productPrice}`,
        originalPrice: productData.productOriginalPrice ? `$${productData.productOriginalPrice}` : null,
        images: images.slice(0, 10), // Limit to 10 images
        description: productData.productLongDescription || '',
        sizes: sizes.length > 0 ? sizes : [],
        color: color,
        sku: productData.productID,
        brand: productData.productBrand || 'Ralph Lauren',
        category: productData.productCategory || '',
        isOnSale: productData.productPriceType === 'MP' || !!productData.productOriginalPrice,
        inStock: productData.productStockMessage === 'IN_STOCK',
        url: url
      };
    } else {
      // Fallback to basic extraction
      console.log('⚠️ No digitalData found, using fallback extraction');
      console.log('Meta data:', metaData);
      return {
        name: metaData.name,
        price: metaData.price || 'Price not available',
        originalPrice: null,
        images: images.slice(0, 10),
        description: '',
        sizes: sizes,
        color: color,
        sku: url.match(/\/(\d+)\.html/)?.[1] || '',
        brand: 'Ralph Lauren',
        category: '',
        isOnSale: false,
        inStock: true,
        url: url
      };
    }
    
  } catch (error) {
    console.error('Ralph Lauren HTML scraper error:', error.message);
    
    // If it's a 403 or similar, we might be blocked
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      // Return empty data structure instead of throwing
      return {
        name: '',
        price: '$0',
        originalPrice: null,
        images: [],
        description: '',
        sizes: [],
        color: '',
        sku: url.match(/\/(\d+)\.html/)?.[1] || '',
        brand: 'Ralph Lauren',
        category: '',
        isOnSale: false,
        inStock: false,
        url: url,
        error: `Blocked: ${error.response.status}`
      };
    }
    
    throw error;
  }
}

module.exports = { scrapeRalphLauren: scrapeRalphLaurenHTML };