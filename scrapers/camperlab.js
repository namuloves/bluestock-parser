const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeCamperlab = async (url) => {
  console.log('👟 Starting Camperlab scraper for:', url);
  
  try {
    // Headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Camperlab page...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Check if it's a product listing page or product detail page
    const isProductPage = url.includes('/shoes/') && url.split('/').length > 6;
    
    if (isProductPage) {
      return scrapeProductPage($, url);
    } else {
      return scrapeListingPage($, url);
    }
    
  } catch (error) {
    console.error('❌ Camperlab scraper error:', error.message);
    throw error;
  }
};

const scrapeProductPage = ($, url) => {
  console.log('📦 Scraping product page...');
  
  const product = {
    url,
    name: '',
    price: '',
    originalPrice: '',
    description: '',
    images: [],
    brand: 'Camperlab',
    sizes: [],
    colors: [],
    variants: [],
    inStock: true,
    currency: 'USD',
    sku: '',
    category: 'Shoes'
  };
  
  // Product name - multiple possible selectors
  const nameSelectors = [
    'h1.product-name',
    '[data-testid="product-name"]',
    '.product-info h1',
    '.product-header h1',
    'h1[itemprop="name"]',
    '.product-title',
    '.pdp-name',
    '.product-details h1'
  ];
  
  for (const selector of nameSelectors) {
    const name = $(selector).first().text().trim();
    if (name) {
      product.name = name;
      console.log('✓ Found product name:', name);
      break;
    }
  }
  
  // Price extraction
  const priceSelectors = [
    '.product-price',
    '.price-now',
    '[data-testid="product-price"]',
    '.pdp-price',
    '.current-price',
    '.price span',
    '[itemprop="price"]',
    '.product-info .price'
  ];
  
  for (const selector of priceSelectors) {
    const priceText = $(selector).first().text().trim();
    if (priceText && priceText.includes('$')) {
      product.price = priceText.replace(/[^0-9.,]/g, '').trim();
      console.log('✓ Found price:', product.price);
      break;
    }
  }
  
  // Original price (if on sale)
  const originalPriceSelectors = [
    '.price-was',
    '.original-price',
    '.compare-at-price',
    '.old-price',
    'span.line-through'
  ];
  
  for (const selector of originalPriceSelectors) {
    const originalPriceText = $(selector).first().text().trim();
    if (originalPriceText && originalPriceText.includes('$')) {
      product.originalPrice = originalPriceText.replace(/[^0-9.,]/g, '').trim();
      console.log('✓ Found original price:', product.originalPrice);
      break;
    }
  }
  
  // Images
  const imageSelectors = [
    '.product-images img',
    '.product-gallery img',
    '.pdp-images img',
    '[data-testid="product-image"]',
    '.product-photo img',
    '.media-gallery img'
  ];
  
  for (const selector of imageSelectors) {
    $(selector).each((i, el) => {
      let imgSrc = $(el).attr('src') || $(el).attr('data-src');
      if (imgSrc) {
        // Handle relative URLs
        if (!imgSrc.startsWith('http')) {
          imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` : `https://www.camperlab.com${imgSrc}`;
        }
        // Clean up image URL parameters for high quality
        imgSrc = imgSrc.replace(/_[A-Z](\.jpg|\.png)/i, '_L$1');
        if (!product.images.includes(imgSrc)) {
          product.images.push(imgSrc);
        }
      }
    });
    if (product.images.length > 0) {
      console.log(`✓ Found ${product.images.length} images`);
      break;
    }
  }
  
  // Sizes
  const sizeSelectors = [
    '.size-selector button',
    '.size-options button',
    '[data-testid="size-button"]',
    '.pdp-sizes button',
    '.size-list button',
    'input[name="size"] + label'
  ];
  
  for (const selector of sizeSelectors) {
    $(selector).each((i, el) => {
      const size = $(el).text().trim();
      const isAvailable = !$(el).hasClass('disabled') && !$(el).attr('disabled');
      if (size && isAvailable) {
        product.sizes.push(size);
      }
    });
    if (product.sizes.length > 0) {
      console.log(`✓ Found ${product.sizes.length} sizes`);
      break;
    }
  }
  
  // Colors
  const colorSelectors = [
    '.color-selector button',
    '.color-options button',
    '[data-testid="color-button"]',
    '.pdp-colors button',
    '.color-list button'
  ];
  
  for (const selector of colorSelectors) {
    $(selector).each((i, el) => {
      const color = $(el).attr('aria-label') || $(el).attr('title') || $(el).text().trim();
      if (color && !product.colors.includes(color)) {
        product.colors.push(color);
      }
    });
    if (product.colors.length > 0) {
      console.log(`✓ Found ${product.colors.length} colors`);
      break;
    }
  }
  
  // Description
  const descriptionSelectors = [
    '.product-description',
    '[data-testid="product-description"]',
    '.pdp-description',
    '.product-info-section',
    '.product-details-content'
  ];
  
  for (const selector of descriptionSelectors) {
    const description = $(selector).first().text().trim();
    if (description) {
      product.description = description.substring(0, 500);
      console.log('✓ Found product description');
      break;
    }
  }
  
  // SKU extraction
  const skuSelectors = [
    '[data-sku]',
    '[data-product-id]',
    '.product-sku',
    '.sku-value'
  ];
  
  for (const selector of skuSelectors) {
    const sku = $(selector).first().attr('data-sku') || 
                $(selector).first().attr('data-product-id') || 
                $(selector).first().text().trim();
    if (sku) {
      product.sku = sku;
      console.log('✓ Found SKU:', sku);
      break;
    }
  }
  
  // Extract from URL if SKU not found
  if (!product.sku) {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const skuMatch = lastPart.match(/K\d+(-\d+)?/);
    if (skuMatch) {
      product.sku = skuMatch[0];
      console.log('✓ Extracted SKU from URL:', product.sku);
    }
  }
  
  // Check stock availability
  const outOfStockSelectors = [
    '.out-of-stock',
    '.sold-out',
    '[data-testid="out-of-stock"]',
    '.unavailable'
  ];
  
  for (const selector of outOfStockSelectors) {
    if ($(selector).length > 0) {
      product.inStock = false;
      console.log('⚠️ Product is out of stock');
      break;
    }
  }
  
  // Try to extract from JSON-LD
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json['@type'] === 'Product' || json.product) {
        const productData = json.product || json;
        if (!product.name && productData.name) product.name = productData.name;
        if (!product.price && productData.offers?.price) product.price = productData.offers.price.toString();
        if (!product.sku && productData.sku) product.sku = productData.sku;
        if (!product.description && productData.description) product.description = productData.description.substring(0, 500);
        if (productData.image && Array.isArray(productData.image)) {
          productData.image.forEach(img => {
            if (!product.images.includes(img)) product.images.push(img);
          });
        }
        console.log('✓ Extracted data from JSON-LD');
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });
  
  return product;
};

const scrapeListingPage = ($, url) => {
  console.log('📋 Scraping listing page...');
  
  const products = [];
  
  // Product card selectors
  const productCardSelectors = [
    '.product-card',
    '.product-item',
    '[data-testid="product-card"]',
    '.product-tile',
    'article.product',
    '.grid-item',
    'a[href*="/shoes/"]'
  ];
  
  let productCards = $();
  for (const selector of productCardSelectors) {
    productCards = $(selector);
    if (productCards.length > 0) {
      console.log(`✓ Found ${productCards.length} products using selector: ${selector}`);
      break;
    }
  }
  
  productCards.each((i, el) => {
    const $card = $(el);
    const product = {
      name: '',
      price: '',
      url: '',
      image: '',
      brand: 'Camperlab'
    };
    
    // Extract product URL
    const link = $card.is('a') ? $card.attr('href') : $card.find('a').first().attr('href');
    if (link) {
      product.url = link.startsWith('http') ? link : `https://www.camperlab.com${link}`;
    }
    
    // Extract product name
    const nameSelectors = [
      '.product-name',
      '.product-title',
      'h2',
      'h3',
      '.title',
      '[data-testid="product-name"]'
    ];
    
    for (const selector of nameSelectors) {
      const name = $card.find(selector).first().text().trim();
      if (name) {
        product.name = name;
        break;
      }
    }
    
    // If no name found, try to extract from link text or alt text
    if (!product.name) {
      product.name = $card.find('img').first().attr('alt') || 
                     $card.text().trim().split('\n')[0] || 
                     'Camperlab Product';
    }
    
    // Extract price
    const priceSelectors = [
      '.product-price',
      '.price',
      '[data-testid="product-price"]',
      '.amount'
    ];
    
    for (const selector of priceSelectors) {
      const priceText = $card.find(selector).first().text().trim();
      if (priceText && priceText.includes('$')) {
        product.price = priceText.replace(/[^0-9.,]/g, '').trim();
        break;
      }
    }
    
    // Extract image
    const img = $card.find('img').first();
    if (img.length) {
      let imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-original');
      if (imgSrc) {
        if (!imgSrc.startsWith('http')) {
          imgSrc = imgSrc.startsWith('//') ? `https:${imgSrc}` : `https://www.camperlab.com${imgSrc}`;
        }
        product.image = imgSrc;
      }
    }
    
    // Only add products with at least a URL
    if (product.url) {
      products.push(product);
    }
  });
  
  console.log(`✅ Found ${products.length} products on listing page`);
  
  return {
    products,
    totalProducts: products.length,
    pageUrl: url
  };
};

module.exports = scrapeCamperlab;