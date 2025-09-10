const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

// Use puppeteer-extra with stealth plugin for better anti-detection
let puppeteer;
try {
  puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  console.log('✅ Using puppeteer-extra with stealth plugin');
} catch (e) {
  // Fall back to regular puppeteer if puppeteer-extra not available
  try {
    puppeteer = require('puppeteer');
    console.log('⚠️ Using regular puppeteer (no stealth)');
  } catch (e2) {
    console.log('❌ Puppeteer not available');
  }
}

const scrapeNetAPorter = async (url) => {
  console.log('💎 Starting Net-a-Porter scraper for:', url);
  
  let browser;
  try {
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      colors: [],
      inStock: true,
      designer: '',
      currency: 'USD'
    };
    
    let $;
    let htmlContent = '';
    
    // Try axios first with shorter timeout
    try {
      console.log('📡 Attempting with axios first...');
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.net-a-porter.com/'
      };
      
      const axiosConfig = getAxiosConfig(url, {
        headers,
        timeout: 8000, // Shorter timeout to fail fast
        maxRedirects: 5
      });
      
      const response = await axios.get(url, axiosConfig);
      htmlContent = response.data;
      $ = cheerio.load(htmlContent);
      console.log('✅ Successfully fetched with axios');
      
    } catch (axiosError) {
      console.log('⚠️ Axios failed:', axiosError.message);
      
      // Fall back to Puppeteer if available
      if (!puppeteer) {
        throw new Error('Unable to fetch page - Net-a-Porter requires JavaScript rendering and Puppeteer is not available');
      }
      
      console.log('📱 Using Puppeteer for Net-a-Porter...');
      
      const puppeteerOptions = {
        headless: process.env.NODE_ENV === 'production' ? 'new' : false, // Headless in production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=site-per-process',
          '--window-size=1920,1080',
          '--start-maximized'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      };
      
      // Use system Chrome if available (for Docker/Railway)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      
      browser = await puppeteer.launch(puppeteerOptions);
      const page = await browser.newPage();
      
      // Randomize viewport to appear more human
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 }
      ];
      const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
      await page.setViewport(randomViewport);
      
      // Rotate user agents
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUA);
      
      // Set extra headers to appear more legitimate
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      });
      
      // Add mouse movements to appear human
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
      });
      
      console.log('📍 Navigating to URL...');
      
      // Navigate with dom content loaded first
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait and simulate human behavior
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      
      // Move mouse to simulate human
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 300);
      
      // Wait for network to settle
      try {
        await page.waitForTimeout(2000);
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Wait for product content to load
      try {
        await page.waitForSelector('h1, [data-testid="product-name"], .product-name', { timeout: 5000 });
      } catch (e) {
        console.log('⚠️ Could not find product selectors, continuing...');
      }
      
      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get the HTML content
      htmlContent = await page.content();
      $ = cheerio.load(htmlContent);
      
      console.log('✅ Successfully fetched with Puppeteer');
    }
    
    // Extract product data
    console.log('📊 Extracting product data...');
    
    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product') {
          product.name = jsonData.name || '';
          product.description = jsonData.description || '';
          
          if (jsonData.image) {
            if (typeof jsonData.image === 'string') {
              product.images.push(jsonData.image);
            } else if (Array.isArray(jsonData.image)) {
              product.images = jsonData.image;
            }
          }
          
          if (jsonData.offers) {
            const offer = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            if (offer.price) {
              product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
            }
            product.inStock = offer.availability?.includes('InStock') || false;
            
            // Extract currency
            if (offer.priceCurrency) {
              product.currency = offer.priceCurrency;
            }
          }
          
          if (jsonData.brand) {
            product.brand = jsonData.brand.name || jsonData.brand;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // HTML fallbacks - Net-a-Porter specific selectors
    if (!product.name) {
      product.name = $('h1.ProductDetails24__name').text().trim() ||
                     $('h1[data-testid="product-name"]').text().trim() ||
                     $('h1.product-name').text().trim() ||
                     $('h1').first().text().trim() ||
                     $('.product-name').text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!product.brand) {
      product.brand = $('.ProductDetails24__designer a').text().trim() ||
                      $('[data-testid="product-designer"]').text().trim() ||
                      $('.designer-name').text().trim() ||
                      $('a[href*="/designers/"]').first().text().trim() || '';
    }
    
    if (!product.price) {
      // Look for current price
      const priceText = $('.PriceWithSchema9__value').text().trim() ||
                       $('[data-testid="product-price"]').text().trim() ||
                       $('.product-price').text().trim() ||
                       $('[class*="price"]:not([class*="original"])').first().text().trim() || '';
      
      if (priceText) {
        const priceMatch = priceText.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
        if (priceMatch) {
          product.price = priceMatch[0];
          
          // Extract currency
          const currencyMatch = product.price.match(/[\$£€¥]/);
          if (currencyMatch) {
            switch(currencyMatch[0]) {
              case '£': product.currency = 'GBP'; break;
              case '€': product.currency = 'EUR'; break;
              case '¥': product.currency = 'JPY'; break;
              default: product.currency = 'USD';
            }
          }
        }
      }
    }
    
    // Original price (if on sale)
    const originalPriceText = $('.PriceWithSchema9__value--previous').text().trim() ||
                             $('[data-testid="product-price-original"]').text().trim() ||
                             $('.product-price-original').text().trim() ||
                             $('span[class*="original-price"]').text().trim() || '';
    
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\$£€¥]\s*[\d,]+(?:\.\d{2})?/);
      if (originalMatch) {
        product.originalPrice = originalMatch[0];
      }
    }
    
    if (!product.description) {
      product.description = $('.ProductDetails24__description').text().trim() ||
                           $('[data-testid="product-description"]').text().trim() ||
                           $('.product-description').text().trim() ||
                           $('[class*="description"]').first().text().trim() || '';
    }
    
    // Sizes - Net-a-Porter specific
    $('.SizeSelector52__button, [data-testid*="size"] button, .size-selector button').each((i, el) => {
      const size = $(el).text().trim();
      const isDisabled = $(el).prop('disabled') || 
                         $(el).attr('aria-disabled') === 'true' ||
                         $(el).hasClass('disabled');
      
      if (size && !isDisabled) {
        product.sizes.push(size);
      }
    });
    
    // Also check select dropdowns for sizes
    if (product.sizes.length === 0) {
      $('select[name*="size"] option, select.size-select option').each((i, el) => {
        const size = $(el).text().trim();
        const value = $(el).val();
        if (size && value && !size.toLowerCase().includes('select')) {
          product.sizes.push(size);
        }
      });
    }
    
    // Images - Net-a-Porter specific
    if (product.images.length === 0) {
      const imageSet = new Set();
      
      // Main product images
      $('.ProductImages24__image img, [data-testid="product-image"] img, .product-images img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src') || '';
        
        // Check for higher quality in srcset
        const srcset = $(img).attr('srcset') || $(img).attr('data-srcset');
        if (srcset) {
          const sources = srcset.split(',');
          const highRes = sources[sources.length - 1].trim().split(' ')[0];
          if (highRes) {
            imageUrl = highRes;
          }
        }
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            const baseUrl = new URL(url);
            imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
          }
          
          // Skip placeholder images
          if (imageUrl.includes('http') && !imageUrl.includes('placeholder')) {
            imageSet.add(imageUrl);
          }
        }
      });
      
      product.images = Array.from(imageSet);
    }
    
    // Colors - usually in the product name or as a variant selector
    $('.ColorSelector__button, [data-testid*="color"] button').each((i, el) => {
      const color = $(el).attr('aria-label') || $(el).text().trim();
      if (color) {
        product.colors.push(color);
      }
    });
    
    // Check stock status
    if (htmlContent.toLowerCase().includes('sold out') || 
        htmlContent.toLowerCase().includes('out of stock')) {
      product.inStock = false;
    }
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      const value = product[key];
      if (value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Net-a-Porter product:', product.name || 'Unknown');
    
    if (browser) {
      await browser.close();
    }
    
    return product;
    
  } catch (error) {
    console.error('❌ Net-a-Porter scraping error:', error.message);
    
    if (browser) {
      await browser.close();
    }
    
    // Don't hang - return error quickly
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeNetAPorter };