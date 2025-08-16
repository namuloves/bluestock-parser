const axios = require('axios');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeSaksFifthAvenue(url) {
  try {
    console.log('🔍 Scraping Saks Fifth Avenue...');
    
    // Get axios config with proxy (Puppeteer proxy has 407 auth issues)
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
    
    console.log('📄 Fetching page with Decodo proxy...');
    const response = await axios.get(url, config);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = response.data;
    console.log('✅ Page fetched successfully');
    
    // Extract window.__remixContext data (Saks uses Remix framework)
    const remixMatch = html.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/);
    
    if (!remixMatch) {
      console.log('⚠️ No Remix context found, using fallback extraction');
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
      
      // Extract description from multiple sources
      let description = '';
      
      // Method 1: Look for accordion items (product details, fabric & care, etc.)
      if (productData.body?.nodes) {
        const findAccordionContent = (nodes) => {
          const descriptions = [];
          
          for (const node of nodes) {
            if (node.node?.__typename === 'AccordionView' && node.node.items) {
              node.node.items.forEach(item => {
                if (item.title?.nodes?.[0]?.value?.value && item.content?.nodes) {
                  const title = item.title.nodes[0].value.value;
                  const contentParts = [];
                  
                  // Extract text from content nodes
                  item.content.nodes.forEach(contentNode => {
                    if (contentNode.value?.value) {
                      contentParts.push(contentNode.value.value);
                    }
                  });
                  
                  if (contentParts.length > 0) {
                    descriptions.push(`${title}: ${contentParts.join(' ')}`);
                  }
                }
              });
            }
            
            // Recursively search child nodes
            if (node.nodes && Array.isArray(node.nodes)) {
              descriptions.push(...findAccordionContent(node.nodes));
            }
          }
          
          return descriptions;
        };
        
        const accordionDescriptions = findAccordionContent(productData.body.nodes);
        if (accordionDescriptions.length > 0) {
          description = accordionDescriptions.join(' | ');
        }
      }
      
      // Method 2: Extract from meta description in HTML
      if (!description) {
        const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
        if (metaMatch) {
          description = metaMatch[1];
        }
      }
      
      // Method 3: Extract from og:description
      if (!description) {
        const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);
        if (ogMatch) {
          description = ogMatch[1];
        }
      }
      
      // Method 4: Look for any text content that might be description
      if (!description && productData.body?.data) {
        // Sometimes description is in the data object
        if (typeof productData.body.data === 'object') {
          const dataStr = JSON.stringify(productData.body.data);
          // Look for common description patterns
          const descPatterns = [
            /"description":\s*"([^"]+)"/,
            /"productDescription":\s*"([^"]+)"/,
            /"details":\s*"([^"]+)"/
          ];
          
          for (const pattern of descPatterns) {
            const match = dataStr.match(pattern);
            if (match) {
              description = match[1];
              break;
            }
          }
        }
      }
      
      // Clean up description
      if (description) {
        // Remove HTML entities
        description = description
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      }
      
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
      
      // Extract materials from description
      const materials = [];
      if (description) {
        // Look for percentage patterns (e.g., "95% polyamide, 5% elastane")
        const materialMatches = description.match(/\d+%\s+[\w\s]+/g);
        if (materialMatches) {
          materials.push(...materialMatches);
        }
        
        // Also look for common material keywords
        const materialKeywords = [
          'cotton', 'polyester', 'wool', 'silk', 'linen', 'cashmere', 
          'leather', 'suede', 'nylon', 'rayon', 'spandex', 'elastane',
          'polyamide', 'viscose', 'acrylic', 'modal', 'lyocell'
        ];
        
        const descLower = description.toLowerCase();
        materialKeywords.forEach(material => {
          if (descLower.includes(material) && !materials.some(m => m.toLowerCase().includes(material))) {
            // Check if it's part of a composition
            const compositionMatch = description.match(new RegExp(`\\d+%\\s*${material}`, 'i'));
            if (compositionMatch && !materials.includes(compositionMatch[0])) {
              materials.push(compositionMatch[0]);
            }
          }
        });
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
        materials,
        inStock: sizes.length > 0,
        source: 'saksfifthavenue',
        scrapedAt: new Date().toISOString()
      };
      
      console.log('✅ Successfully scraped Saks product:', result.name);
      console.log('Brand:', result.brand);
      console.log('Price: $' + result.price);
      console.log('Original Price: $' + result.originalPrice);
      console.log('Images found:', result.images.length);
      console.log('Sizes found:', result.sizes);
      console.log('Colors found:', result.colors);
      
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
  
  // Try to extract images - only get main product images, not recommendations
  // Look for product ID from URL
  const productIdMatch = url.match(/\/([0-9]+)\.html/);
  const productId = productIdMatch ? productIdMatch[1] : null;
  
  const imageSet = new Set();
  
  if (productId) {
    // Only match images that contain the product ID
    const imageMatches = html.matchAll(new RegExp(`https://cdn\\.saksfifthavenue\\.com/is/image/saks/${productId}[^"'\\s]*`, 'g'));
    for (const match of imageMatches) {
      imageSet.add(match[0]);
    }
  }
  
  // If no images found with product ID, try to get images from structured data
  if (imageSet.size === 0) {
    // Look for og:image meta tag
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (ogImageMatch) {
      imageSet.add(ogImageMatch[1]);
    }
  }
  
  result.images = Array.from(imageSet);
  
  return result;
}

module.exports = { scrapeSaksFifthAvenue };