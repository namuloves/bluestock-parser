const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');
const { getHostnameFallbackUrl, isDnsResolutionError } = require('../utils/url-normalizer');

const normalizeText = (value = '') => String(value)
  .replace(/\s+/g, ' ')
  .replace(/\u00a0/g, ' ')
  .trim();

const uniqueTextJoin = (parts) => {
  const seen = new Set();
  const output = [];
  for (const part of parts) {
    const cleaned = normalizeText(part);
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
  }
  return output.join('\n');
};

const extractJsonLdProduct = ($) => {
  let productNode = null;

  $('script[type="application/ld+json"]').each((i, el) => {
    if (productNode) return;
    const raw = $(el).html();
    if (!raw) return;

    try {
      const json = JSON.parse(raw);
      const candidates = Array.isArray(json)
        ? json
        : json['@graph']
          ? json['@graph']
          : [json];

      for (const node of candidates) {
        const type = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (type.includes('Product')) {
          productNode = node;
          break;
        }
      }
    } catch (e) {
      // Ignore invalid JSON-LD blocks
    }
  });

  if (!productNode) return {};

  let brand = '';
  if (typeof productNode.brand === 'string') {
    brand = productNode.brand;
  } else if (productNode.brand?.name) {
    brand = productNode.brand.name;
  }

  return {
    description: productNode.description || '',
    brand
  };
};

const extractTextFromSelectors = ($, selectors) => {
  const collected = [];

  for (const selector of selectors) {
    const nodes = $(selector);
    if (!nodes.length) continue;

    nodes.each((i, el) => {
      const text = $(el).text();
      if (text) collected.push(text);
    });
  }

  return uniqueTextJoin(collected);
};

const scrapeShopify = async (url) => {
  console.log('🛍️ Starting Shopify scraper for:', url);
  
  try {
    const originalUrl = url;
    let requestUrl = url;

    // Add headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    const buildAxiosConfig = (targetUrl) => getAxiosConfig(targetUrl, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });

    let axiosConfig = buildAxiosConfig(requestUrl);
    console.log('📡 Fetching Shopify page...');

    let response;
    try {
      response = await axios.get(requestUrl, axiosConfig);
    } catch (error) {
      if (isDnsResolutionError(error)) {
        const fallbackUrl = getHostnameFallbackUrl(requestUrl);
        if (fallbackUrl) {
          console.log('🔁 DNS fallback: retrying Shopify fetch without www prefix');
          requestUrl = fallbackUrl;
          axiosConfig = buildAxiosConfig(requestUrl);
          response = await axios.get(requestUrl, axiosConfig);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Extract product data
    const product = {
      url: originalUrl,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      colors: [],
      variants: [],
      inStock: true,
      currency: 'USD',
      sku: '',
      vendor: ''
    };
    
    // Try to get Shopify product JSON from script tags
    let productJson = null;
    
    // Method 1: Look for ProductJSON in scripts
    $('script').each((i, script) => {
      const scriptContent = $(script).html() || '';
      
      // Look for product JSON patterns
      if (scriptContent.includes('var meta = ') || scriptContent.includes('window.ShopifyAnalytics')) {
        const productMatch = scriptContent.match(/var meta = ({.*?});/s);
        if (productMatch) {
          try {
            const metaData = JSON.parse(productMatch[1]);
            if (metaData.product) {
              productJson = metaData.product;
            }
          } catch (e) {
            // Continue to next method
          }
        }
      }
      
      // Look for window.productJSON
      if (scriptContent.includes('window.productJSON') || scriptContent.includes('Product:')) {
        const jsonMatch = scriptContent.match(/window\.productJSON\s*=\s*({.*?});/s) ||
                          scriptContent.match(/"Product":\s*({.*?})\s*[,}]/s);
        if (jsonMatch) {
          try {
            productJson = JSON.parse(jsonMatch[1]);
          } catch (e) {
            // Continue to next method
          }
        }
      }
    });

    // Method 1b: Look for Product JSON in application/json blocks (Dawn and similar themes)
    if (!productJson) {
      $('script[type="application/json"]').each((i, script) => {
        if (productJson) return;

        const id = ($(script).attr('id') || '').toLowerCase();
        const hasProductJsonMarker = id.includes('productjson') || $(script).attr('data-product-json') !== undefined;

        if (!hasProductJsonMarker) return;

        const raw = $(script).html() || '';
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw);
          const candidate = parsed.product || parsed;
          if (candidate && (candidate.title || candidate.variants)) {
            productJson = candidate;
          }
        } catch (e) {
          // Continue to next block
        }
      });
    }
    
    // Method 2: Try Shopify's .json endpoint
    if (!productJson) {
      try {
        const jsonUrl = requestUrl.includes('?') ? requestUrl.split('?')[0] + '.json' : requestUrl + '.json';
        console.log('📡 Fetching Shopify JSON endpoint...');
        const jsonResponse = await axios.get(jsonUrl, {
          ...axiosConfig,
          validateStatus: (status) => status === 200
        });
        
        if (jsonResponse.data && jsonResponse.data.product) {
          productJson = jsonResponse.data.product;
        }
      } catch (e) {
        console.log('JSON endpoint not available, using HTML parsing');
      }
    }
    
    // If we have JSON data, use it
    if (productJson) {
      console.log('✅ Found Shopify product JSON');

      product.name = productJson.title || '';
      product.vendor = productJson.vendor || '';

      // Override vendor for known brands that use incorrect vendor names
      if (url.includes('stussy.com')) {
        product.brand = 'Stussy';
      } else {
        product.brand = productJson.vendor || '';
      }

      product.description = productJson.description || productJson.body_html || '';
      
      // Clean HTML from description
      if (product.description.includes('<')) {
        const $desc = cheerio.load(product.description);
        product.description = $desc.text().trim();
      }
      
      // Extract images — always fetch the .json endpoint to get ALL images (all color variants)
      // The embedded page JSON only contains the selected variant's images
      try {
        const base = requestUrl.split('?')[0].replace(/\.json$/, '');
        // Normalize to /products/<slug> path for the JSON API
        const jsonApiUrl = base.replace(/\/collections\/[^/]+\/products\//, '/products/') + '.json';
        const fullJsonResp = await axios.get(jsonApiUrl, {
          ...axiosConfig,
          validateStatus: s => s === 200,
          timeout: 10000,
        });
        if (fullJsonResp.data?.product?.images?.length) {
          product.images = fullJsonResp.data.product.images
            .map(img => typeof img === 'string' ? img : (img.src || img.url))
            .filter(Boolean);
        }
      } catch (e) {
        // Fall back to whatever the embedded JSON had
      }

      // Fallback if JSON API fetch failed
      if (product.images.length === 0) {
        if (productJson.images && Array.isArray(productJson.images)) {
          product.images = productJson.images.map(img =>
            typeof img === 'string' ? img : (img.src || img.url)
          ).filter(Boolean);
        } else if (productJson.image) {
          product.images = [productJson.image];
        }
      }
      
      // Extract variants for sizes/colors/prices
      if (productJson.variants && Array.isArray(productJson.variants)) {
        productJson.variants.forEach(variant => {
          const variantData = {
            id: variant.id,
            title: variant.title,
            price: variant.price,
            comparePrice: variant.compare_at_price,
            available: variant.available,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3
          };
          
          product.variants.push(variantData);
          
          // Extract sizes
          if (variant.option1 && !product.sizes.includes(variant.option1)) {
            product.sizes.push(variant.option1);
          }
          
          // Extract colors (usually option2)
          if (variant.option2 && !product.colors.includes(variant.option2)) {
            product.colors.push(variant.option2);
          }
        });
        
        // Get price from first available variant
        const availableVariant = productJson.variants.find(v => v.available) || productJson.variants[0];
        if (availableVariant) {
          // Handle different price formats from Shopify stores
          if (typeof availableVariant.price === 'string') {
            // Price is already a string (like "183.00")
            // Remove any currency symbols and convert to number
            const cleanPrice = availableVariant.price.replace(/[^0-9.]/g, '');
            product.price = parseFloat(cleanPrice) || 0;
          } else if (typeof availableVariant.price === 'number') {
            // Check if price looks like cents (typically > 100 for most products)
            // But also check if it has decimals already
            if (Number.isInteger(availableVariant.price) && availableVariant.price > 100) {
              // Likely in cents, convert to dollars
              product.price = availableVariant.price / 100;
            } else {
              // Already in dollars
              product.price = availableVariant.price;
            }
          }

          if (availableVariant.compare_at_price) {
            if (typeof availableVariant.compare_at_price === 'string') {
              // Remove any currency symbols and convert to number
              const cleanPrice = availableVariant.compare_at_price.replace(/[^0-9.]/g, '');
              product.originalPrice = parseFloat(cleanPrice) || 0;
            } else if (typeof availableVariant.compare_at_price === 'number') {
              // Same logic for compare price
              if (Number.isInteger(availableVariant.compare_at_price) && availableVariant.compare_at_price > 100) {
                product.originalPrice = availableVariant.compare_at_price / 100;
              } else {
                product.originalPrice = availableVariant.compare_at_price;
              }
            }
          }

          product.inStock = availableVariant.available !== false;
        }
      }
    }
    
    // Fallback to HTML parsing if no JSON or missing data
    if (!product.name) {
      product.name = $('h1.product__title').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('h1').first().text().trim();
    }
    
    if (!product.price) {
      const priceText = $('.product__price').text().trim() ||
                        $('[itemprop="price"]').attr('content') ||
                        $('.price').first().text().trim();

      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          // Convert to number, removing commas
          product.price = parseFloat(priceMatch[0].replace(/,/g, '')) || 0;
        }
      }
    }
    
    if (!product.brand) {
      // First try to get brand from meta tags or structured data
      product.brand = $('meta[property="product:brand"]').attr('content') ||
                      $('[itemprop="brand"]').text().trim() ||
                      $('.product__vendor').text().trim();

      if (!product.brand) {
        const jsonLd = extractJsonLdProduct($);
        if (jsonLd.brand) product.brand = jsonLd.brand;
      }

      if (!product.brand) {
        product.brand = $('meta[property="og:site_name"]').attr('content') ||
                        $('meta[name="application-name"]').attr('content') ||
                        $('meta[name="apple-mobile-web-app-title"]').attr('content') ||
                        $('meta[name="twitter:site"]').attr('content') ||
                        '';
        product.brand = product.brand.replace(/^@/, '').trim();
      }
      
      // If no brand found or if it's a different designer, use domain name
      const domainName = new URL(requestUrl).hostname.replace('www.', '').split('.')[0];
      const domainBrand = domainName
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      
      // Special handling for known designer sites
      if (url.includes('ceciliebahnsen.com')) {
        product.brand = 'Cecilie Bahnsen';
      } else if (url.includes('stussy.com')) {
        product.brand = 'Stussy';
      } else if (!product.brand) {
        product.brand = domainBrand;
      }
    }
    
    if (product.images.length === 0) {
      // Extract images from HTML - including picture elements (used by Emurj)
      const imageSet = new Set();
      
      // Standard Shopify selectors - added .product-single__media for nhuhn.com
      $('.product__media img, .product__image img, .product-single__media img, img[itemprop="image"], picture img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src');
        
        // Also check srcset for higher quality images
        const srcset = $(img).attr('srcset');
        if (srcset) {
          // Get the highest resolution image from srcset
          const srcsetParts = srcset.split(',');
          const lastSrc = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0];
          if (lastSrc) {
            imageUrl = lastSrc;
          }
        }
        
        if (imageUrl) {
          // Convert to full URL if relative
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          }
          
          // For Emurj-style URLs, extract a cleaner version
          if (imageUrl.includes('/files/') && imageUrl.includes('?')) {
            // Get base URL without parameters but keep version
            const baseUrl = imageUrl.split('&')[0];
            // Replace with higher resolution version
            imageUrl = baseUrl.replace(/width=\d+/, 'width=1500').replace(/height=\d+/, 'height=1500');
          } else {
            // Standard Shopify image cleanup
            imageUrl = imageUrl.replace(/_\d+x\d+/, '').replace(/\?v=\d+/, '');
          }
          
          imageSet.add(imageUrl);
        }
      });
      
      // Convert Set to Array to remove duplicates
      product.images = Array.from(imageSet);
      
      // For Emurj/similar sites, dedupe by unique image ID and filter out related products
      if (product.images.length > 0 && product.images[0].includes('/files/')) {
        const uniqueImages = new Map();
        
        // First, identify the main product ID from URL
        const urlMatch = requestUrl.match(/\/(\d+)(?:\?.*)?$/);
        const productId = urlMatch ? urlMatch[1] : null;
        
        product.images.forEach(img => {
          // Skip card images (related products)
          if (img.includes('-card-') || img.includes('_card_')) {
            return;
          }
          
          // If we have a product ID, prioritize images that start with it
          if (productId && img.includes(`/${productId}-`)) {
            // Extract unique ID (e.g., "100341-918ef3f3-89d3-4629-a98a-40ed7bfc6903")
            const match = img.match(/\/([^\/]+\-[a-f0-9\-]+)\.(png|jpg|jpeg|webp)/i);
            if (match) {
              const imageId = match[1];
              // Keep the first occurrence of each unique image
              if (!uniqueImages.has(imageId)) {
                uniqueImages.set(imageId, img);
              }
            }
          } else if (!productId) {
            // If no product ID, keep non-card images
            const match = img.match(/\/([^\/]+\-[a-f0-9\-]+)\.(png|jpg|jpeg|webp)/i);
            if (match) {
              const imageId = match[1];
              if (!uniqueImages.has(imageId)) {
                uniqueImages.set(imageId, img);
              }
            }
          }
        });
        
        product.images = Array.from(uniqueImages.values());
      }
    }
    
    if (!product.description) {
      product.description = $('.product__description').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('.product-single__description').text().trim();
    }

    if (!product.description || product.description.length < 20) {
      const jsonLd = extractJsonLdProduct($);
      if (jsonLd.description) {
        product.description = normalizeText(jsonLd.description);
      }
    }

    if (!product.description || product.description.length < 40) {
      const detailsSelectors = [
        '[data-product-description]',
        '.product__description',
        '.product__description p',
        '.product-single__description',
        '.product__text',
        '.product__info',
        '.product__details',
        '.product__accordion .accordion__content',
        '.product__accordion-content',
        '.accordion__content',
        '.Accordion__Panel',
        '.accordion__panel',
        '.product-tabs__content',
        '.product__tab-content',
        '[data-accordion-content]',
        '.rte'
      ];

      const detailsText = extractTextFromSelectors($, detailsSelectors);
      if (detailsText) {
        const normalizedExisting = normalizeText(product.description || '');
        if (!normalizedExisting) {
          product.description = detailsText;
        } else if (!normalizedExisting.includes(detailsText)) {
          product.description = uniqueTextJoin([normalizedExisting, detailsText]);
        }
      }
    }
    
    // Ensure prices are numbers (not strings with currency symbols)
    // This helps maintain consistency across all scrapers
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Shopify product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Shopify scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Check if a URL is a Shopify store
const isShopifyStore = async (url) => {
  try {
    // Exclude known non-Shopify sites that use Shopify CDN
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('fredhome.com.au')) {
      console.log('❌ fredhome.com.au is not a real Shopify store (Nuxt.js app)');
      return false;
    }

    let requestUrl = url;
    const buildConfig = (targetUrl) => ({
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    let response;
    try {
      response = await axios.get(requestUrl, buildConfig(requestUrl));
    } catch (error) {
      if (isDnsResolutionError(error)) {
        const fallbackUrl = getHostnameFallbackUrl(requestUrl);
        if (fallbackUrl) {
          console.log('🔁 DNS fallback: retrying Shopify detection without www prefix');
          requestUrl = fallbackUrl;
          response = await axios.get(requestUrl, buildConfig(requestUrl));
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const html = response.data.toLowerCase();

    // More specific Shopify detection - look for actual Shopify markers, not just CDN usage
    const hasShopifyMarkers = (
      html.includes('shopify.com/s/files') ||  // Actual Shopify file structure
      html.includes('myshopify.com') ||        // Shopify subdomain
      html.includes('/cdn/shop/') ||            // Shopify shop CDN
      html.includes('shopify_checkout') ||      // Shopify checkout
      html.includes('shopify.analytics') ||     // Shopify analytics
      html.includes('var shopify =') ||         // Shopify JS object
      html.includes('"shopify":') ||            // Shopify in JSON
      html.includes('shopify-section')          // Shopify theme sections
    );

    // Just having cdn.shopify in images is not enough - many sites use Shopify CDN
    return hasShopifyMarkers;
  } catch (error) {
    return false;
  }
};

module.exports = { scrapeShopify, isShopifyStore };
