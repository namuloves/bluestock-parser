const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeInstagram = async (url) => {
  console.log('📸 Starting Instagram scraper for:', url);
  
  try {
    // Instagram URLs can be:
    // - Posts: instagram.com/p/ABC123/
    // - Reels: instagram.com/reel/ABC123/
    // - Shopping: instagram.com/p/ABC123/ (with product tags)
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };
    
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Instagram page...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Extract product data
    const product = {
      url,
      platform: 'instagram',
      type: 'post',
      caption: '',
      images: [],
      brand: '',
      products: [], // Instagram posts can have multiple tagged products
      username: '',
      postDate: ''
    };
    
    // Try to find shared data in script tags
    let sharedData = null;
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      
      // Look for window._sharedData
      if (scriptContent.includes('window._sharedData')) {
        const dataMatch = scriptContent.match(/window\._sharedData\s*=\s*({.*?});/s);
        if (dataMatch) {
          try {
            sharedData = JSON.parse(dataMatch[1]);
          } catch (e) {
            console.log('Failed to parse shared data');
          }
        }
      }
      
      // Look for additional data in other formats
      if (scriptContent.includes('{"graphql":') || scriptContent.includes('"entry_data":')) {
        try {
          const jsonMatch = scriptContent.match(/({.*"entry_data".*})/s);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            if (data.entry_data) {
              sharedData = data;
            }
          }
        } catch (e) {
          // Continue
        }
      }
    });
    
    // Extract from meta tags as fallback
    const metaDescription = $('meta[property="og:description"]').attr('content') || 
                           $('meta[name="description"]').attr('content') || '';
    const metaTitle = $('meta[property="og:title"]').attr('content') || '';
    const metaImage = $('meta[property="og:image"]').attr('content');
    
    // Parse username from meta title (format: "Username on Instagram: ...")
    if (metaTitle) {
      const usernameMatch = metaTitle.match(/^([^:]+?)(?:\s+on\s+Instagram|:)/);
      if (usernameMatch) {
        product.username = usernameMatch[1].trim().replace('@', '');
      }
    }
    
    // Extract caption/description
    if (metaDescription) {
      // Format: "X likes, Y comments - Username on Instagram: Caption text"
      const captionMatch = metaDescription.match(/Instagram:\s*[""]?(.+?)[""]?$/);
      if (captionMatch) {
        product.caption = captionMatch[1].trim();
      } else {
        product.caption = metaDescription;
      }
      
      // Try to extract brand mentions from caption
      const brandMentions = product.caption.match(/@[\w.]+/g);
      if (brandMentions && brandMentions.length > 0) {
        product.brand = brandMentions[0].replace('@', '');
      }
    }
    
    // Add meta image
    if (metaImage) {
      product.images.push(metaImage);
    }
    
    // If we have sharedData, extract more details
    if (sharedData) {
      try {
        // Navigate through Instagram's data structure
        const postData = sharedData.entry_data?.PostPage?.[0]?.graphql?.shortcode_media ||
                        sharedData.entry_data?.PostPage?.[0]?.media;
        
        if (postData) {
          // Extract images
          if (postData.display_url && !product.images.includes(postData.display_url)) {
            product.images.push(postData.display_url);
          }
          
          // Check for carousel (multiple images)
          if (postData.edge_sidecar_to_children) {
            postData.edge_sidecar_to_children.edges.forEach(edge => {
              if (edge.node?.display_url && !product.images.includes(edge.node.display_url)) {
                product.images.push(edge.node.display_url);
              }
            });
          }
          
          // Extract caption
          if (postData.edge_media_to_caption?.edges?.[0]?.node?.text) {
            product.caption = postData.edge_media_to_caption.edges[0].node.text;
          }
          
          // Extract username
          if (postData.owner?.username) {
            product.username = postData.owner.username;
          }
          
          // Extract timestamp
          if (postData.taken_at_timestamp) {
            product.postDate = new Date(postData.taken_at_timestamp * 1000).toISOString();
          }
          
          // Check for product tags
          if (postData.edge_media_to_tagged_user) {
            postData.edge_media_to_tagged_user.edges.forEach(edge => {
              if (edge.node?.user?.username) {
                product.products.push({
                  brand: edge.node.user.username,
                  x: edge.node.x,
                  y: edge.node.y
                });
              }
            });
          }
        }
      } catch (e) {
        console.log('Error parsing Instagram data structure:', e.message);
      }
    }
    
    // Try to extract shopping products if present
    const productButtons = $('.shopping-product-button, [aria-label*="View products"]');
    if (productButtons.length > 0) {
      product.type = 'shopping_post';
    }
    
    // Look for product information in the page
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product' || jsonData.products) {
          product.products.push({
            name: jsonData.name,
            brand: jsonData.brand?.name || jsonData.brand,
            price: jsonData.offers?.price,
            url: jsonData.url
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Format as product-like response
    const result = {
      url,
      name: product.caption.substring(0, 100) || `Instagram post by @${product.username}`,
      brand: product.brand || product.username || 'Instagram User',
      description: product.caption,
      images: product.images,
      platform: 'instagram',
      metadata: {
        type: product.type,
        username: product.username,
        postDate: product.postDate,
        taggedProducts: product.products
      }
    };
    
    // If there are tagged products, use the first one as main product
    if (product.products.length > 0 && product.products[0].name) {
      result.name = product.products[0].name;
      result.brand = product.products[0].brand || result.brand;
      result.price = product.products[0].price;
      result.productUrl = product.products[0].url;
    }
    
    // Clean up empty fields
    Object.keys(result).forEach(key => {
      if (result[key] === '' || (Array.isArray(result[key]) && result[key].length === 0)) {
        delete result[key];
      }
    });
    
    console.log('✅ Successfully scraped Instagram post');
    console.log('   Type:', product.type);
    console.log('   Username:', product.username || 'Unknown');
    console.log('   Products tagged:', product.products.length);
    
    return result;
    
  } catch (error) {
    console.error('❌ Instagram scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      platform: 'instagram',
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeInstagram };