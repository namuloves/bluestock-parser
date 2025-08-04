const axios = require('axios');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeSaksFifthAvenue(url) {
  try {
    console.log('🔍 Scraping Saks Fifth Avenue with axios...');
    
    // Get axios config with proxy
    const config = getAxiosConfig(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      timeout: 30000
    });
    
    console.log('📄 Fetching page...');
    const response = await axios.get(url, config);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = response.data;
    console.log('✅ Page fetched, extracting data...');
    
    // Extract window.__remixContext data
    const remixMatch = html.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/);
    
    if (!remixMatch) {
      console.log('⚠️ No Remix context found, trying alternative extraction...');
      return extractFallbackData(html, url);
    }
    
    try {
      // Parse the JSON data
      const remixData = JSON.parse(remixMatch[1]);
      
      // Navigate to product data
      const productRoute = remixData?.state?.loaderData?.['routes/product.$'];
      const productData = productRoute?.productData;
      
      if (!productData) {
        console.log('⚠️ No product data in Remix context');
        return extractFallbackData(html, url);
      }
      
      // Extract brand from title nodes
      let brand = 'Unknown Brand';
      if (productData.title?.nodes?.[0]) {
        brand = productData.title.nodes[0].value?.value || brand;
      }
      
      // Extract product name from subtitle
      let name = 'Unknown Product';
      if (productData.subtitle?.value?.value) {
        name = productData.subtitle.value.value;
      }
      
      // Extract prices
      let price = 0;
      let originalPrice = null;
      
      if (productData.currentPrice?.formatted?.value?.value) {
        const priceStr = productData.currentPrice.formatted.value.value;
        price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      }
      
      if (productData.strikethroughPrice?.formatted?.value?.value) {
        const origPriceStr = productData.strikethroughPrice.formatted.value.value;
        originalPrice = parseFloat(origPriceStr.replace(/[^0-9.]/g, ''));
      }
      
      // Extract images
      const images = [];
      if (productData.media && Array.isArray(productData.media)) {
        productData.media.forEach(item => {
          if (item.url?.value) {
            images.push(item.url.value);
          }
        });
      }
      
      // Extract sizes
      const sizes = [];
      if (productData.sizes?.items) {
        productData.sizes.items.forEach(item => {
          if (item.input?.id && !item.isDisabled) {
            sizes.push(item.input.id);
          }
        });
      }
      
      // If no sizes in that location, check body data
      if (sizes.length === 0 && productData.body?.data?.sizes) {
        Object.keys(productData.body.data.sizes).forEach(size => {
          if (productData.body.data.sizes[size]?.title) {
            sizes.push(productData.body.data.sizes[size].title);
          }
        });
      }
      
      // Extract colors
      const colors = [];
      let currentColor = '';
      
      if (productData.colors?.items) {
        productData.colors.items.forEach(item => {
          const colorId = item.item?.input?.id;
          if (colorId) {
            colors.push(colorId);
          }
        });
        
        // Get selected color
        if (productData.colors.selected?.id) {
          currentColor = productData.colors.selected.id;
        }
      }
      
      // If no colors in that location, check body data
      if (colors.length === 0 && productData.body?.data?.colors) {
        Object.keys(productData.body.data.colors).forEach(color => {
          if (productData.body.data.colors[color]?.title) {
            colors.push(productData.body.data.colors[color].title);
          }
        });
      }
      
      // Extract product ID
      const productId = productData.masterProductId || '';
      
      // Extract description (may need to look in other parts of the data)
      let description = '';
      
      // Check analytics data for additional info
      const analyticsProduct = productData.body?.analyticsData?.product_event?.products?.[0];
      
      if (analyticsProduct) {
        // Use analytics data to fill in any missing info
        if (!brand || brand === 'Unknown Brand') {
          brand = analyticsProduct.brand || brand;
        }
        if (!name || name === 'Unknown Product') {
          name = analyticsProduct.name || name;
        }
        if (!currentColor && analyticsProduct.color) {
          currentColor = analyticsProduct.color;
        }
      }
      
      // Build result
      const result = {
        url,
        name,
        brand,
        price,
        originalPrice,
        currency: 'USD',
        description,
        images,
        sizes,
        color: currentColor,
        colors,
        productId,
        materials: [],
        inStock: sizes.length > 0,
        source: 'saksfifthavenue',
        scrapedAt: new Date().toISOString()
      };
      
      console.log('✅ Successfully scraped Saks product:', result.name);
      console.log('Brand:', result.brand);
      console.log('Price:', result.price);
      console.log('Original Price:', result.originalPrice);
      console.log('Images found:', result.images.length);
      console.log('Sizes found:', result.sizes.length);
      console.log('Colors found:', result.colors.length);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error parsing Remix data:', error.message);
      return extractFallbackData(html, url);
    }
    
  } catch (error) {
    console.error('❌ Error scraping Saks Fifth Avenue:', error.message);
    
    return {
      url,
      name: 'Error loading product',
      brand: '',
      price: 0,
      currency: 'USD',
      description: '',
      images: [],
      sizes: [],
      color: '',
      productId: '',
      materials: [],
      inStock: false,
      source: 'saksfifthavenue',
      error: error.message,
      scrapedAt: new Date().toISOString()
    };
  }
}

// Fallback extraction from HTML
function extractFallbackData(html, url) {
  console.log('Using fallback HTML extraction...');
  
  const result = {
    url,
    name: 'Unknown Product',
    brand: 'Unknown Brand',
    price: 0,
    originalPrice: null,
    currency: 'USD',
    description: '',
    images: [],
    sizes: [],
    color: '',
    colors: [],
    productId: '',
    materials: [],
    inStock: false,
    source: 'saksfifthavenue',
    scrapedAt: new Date().toISOString()
  };
  
  // Try to extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (titleMatch) {
    const titleParts = titleMatch[1].split('|');
    if (titleParts.length > 0) {
      result.name = titleParts[0].trim();
    }
  }
  
  // Try to extract images
  const imageMatches = html.matchAll(/https:\/\/cdn\.saksfifthavenue\.com\/is\/image\/saks\/[^"'\s]+/g);
  const imageSet = new Set();
  for (const match of imageMatches) {
    imageSet.add(match[0]);
  }
  result.images = Array.from(imageSet);
  
  return result;
}

module.exports = { scrapeSaksFifthAvenue };