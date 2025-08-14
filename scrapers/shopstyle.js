const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeShopStyle = async (url) => {
  console.log('🔗 Starting ShopStyle scraper for:', url);
  
  try {
    // ShopStyle URLs are typically shortened links that redirect to actual products
    // Example: https://shopstyle.it/l/cgRZ9
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 10, // Allow more redirects for affiliate links
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Following ShopStyle redirect...');
    
    // First, try to follow the redirect to get the actual product URL
    let finalUrl = url;
    let finalResponse = null;
    
    try {
      const response = await axios.get(url, {
        ...axiosConfig,
        maxRedirects: 0, // Don't follow redirects automatically
        validateStatus: (status) => status < 400
      });
      
      // Check for redirect
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log('🔄 Redirect found:', redirectUrl.substring(0, 50) + '...');
          finalUrl = redirectUrl;
          
          // Follow the redirect
          finalResponse = await axios.get(redirectUrl, axiosConfig);
        }
      } else {
        finalResponse = response;
      }
    } catch (error) {
      if (error.response && error.response.status >= 300 && error.response.status < 400) {
        const redirectUrl = error.response.headers.location;
        if (redirectUrl) {
          console.log('🔄 Redirect found in error:', redirectUrl.substring(0, 50) + '...');
          finalUrl = redirectUrl;
          finalResponse = await axios.get(redirectUrl, axiosConfig);
        }
      } else {
        throw error;
      }
    }
    
    if (!finalResponse) {
      finalResponse = await axios.get(url, axiosConfig);
    }
    
    const $ = cheerio.load(finalResponse.data);
    
    // Extract product data - ShopStyle often has its own product page format
    const product = {
      url: finalUrl,
      originalUrl: url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      retailer: '',
      inStock: true
    };
    
    // Check if we're on a ShopStyle product page
    const isShopStylePage = finalUrl.includes('shopstyle') || finalResponse.data.includes('ShopStyle');
    
    if (isShopStylePage) {
      // ShopStyle product page selectors
      product.name = $('.product-name').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('h1.product-title').text().trim() ||
                     $('meta[property="og:title"]').attr('content');
      
      product.brand = $('.product-brand').text().trim() ||
                      $('.brand-name').text().trim() ||
                      $('[itemprop="brand"]').text().trim();
      
      const priceText = $('.product-price').text().trim() ||
                        $('.price-display').text().trim() ||
                        $('[itemprop="price"]').text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = '$' + priceMatch[0];
        }
      }
      
      // Get retailer info
      product.retailer = $('.retailer-name').text().trim() ||
                         $('.merchant-name').text().trim();
      
      // Extract images
      $('.product-image img, .product-photo img').each((i, img) => {
        const imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl && !product.images.includes(imageUrl)) {
          product.images.push(imageUrl);
        }
      });
      
      // Meta tag fallbacks
      if (!product.name) {
        product.name = $('meta[property="og:title"]').attr('content') ||
                       $('title').text().split('|')[0].trim();
      }
      
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
      
      product.description = $('.product-description').text().trim() ||
                            $('meta[property="og:description"]').attr('content') ||
                            '';
      
    } else {
      // We've been redirected to the actual retailer site
      // Try generic extraction
      console.log('📍 Redirected to retailer site:', new URL(finalUrl).hostname);
      
      product.retailer = new URL(finalUrl).hostname.replace('www.', '');
      
      // Generic selectors that work on many sites
      product.name = $('h1').first().text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('title').text().split('|')[0].trim();
      
      product.brand = $('[itemprop="brand"]').text().trim() ||
                      $('.brand').first().text().trim() ||
                      $('meta[property="product:brand"]').attr('content');
      
      // Price extraction
      const priceSelectors = [
        '[itemprop="price"]',
        '.price',
        '.product-price',
        '.current-price',
        'meta[property="product:price:amount"]'
      ];
      
      for (const selector of priceSelectors) {
        const element = $(selector);
        if (element.length) {
          const priceText = element.attr('content') || element.text().trim();
          const priceMatch = priceText.match(/[\d,]+\.?\d*/);
          if (priceMatch) {
            product.price = '$' + priceMatch[0];
            break;
          }
        }
      }
      
      // Images
      const imageSelectors = [
        'meta[property="og:image"]',
        'img[itemprop="image"]',
        '.product-image img',
        '.product-photo img'
      ];
      
      for (const selector of imageSelectors) {
        const element = $(selector);
        if (element.length) {
          const imageUrl = element.attr('content') || element.attr('src');
          if (imageUrl && !product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      }
      
      product.description = $('meta[property="og:description"]').attr('content') ||
                            $('[itemprop="description"]').text().trim() ||
                            '';
    }
    
    // Check stock status
    const outOfStockIndicators = [
      'out of stock',
      'sold out',
      'unavailable',
      'no longer available'
    ];
    
    const pageText = $('body').text().toLowerCase();
    for (const indicator of outOfStockIndicators) {
      if (pageText.includes(indicator)) {
        product.inStock = false;
        break;
      }
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped ShopStyle product:', product.name || 'Unknown');
    console.log('   Retailer:', product.retailer || 'Unknown');
    
    return product;
    
  } catch (error) {
    console.error('❌ ShopStyle scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeShopStyle };