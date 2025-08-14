const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapePoshmark = async (url) => {
  console.log('👗 Starting Poshmark scraper for:', url);
  
  try {
    // Extract listing ID from URL
    const listingIdMatch = url.match(/listing\/[^\/]+-([a-f0-9]+)$/);
    const listingId = listingIdMatch ? listingIdMatch[1] : null;
    
    // Add headers to mimic a real browser
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
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // Get axios config with proxy if needed
    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    console.log('📡 Fetching Poshmark page with proxy support...');
    const response = await axios.get(url, axiosConfig);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Extract product data
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      size: '',
      sizes: [],
      color: '',
      colors: [],
      condition: '',
      category: '',
      seller: '',
      inStock: true,
      details: []
    };
    
    // Try to extract data from JSON-LD structured data first
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let structuredData = null;
    
    jsonLdScripts.each((i, script) => {
      try {
        const data = JSON.parse($(script).html());
        if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].find(item => item['@type'] === 'Product'))) {
          structuredData = data['@type'] === 'Product' ? data : data['@graph'].find(item => item['@type'] === 'Product');
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    if (structuredData) {
      // Extract from structured data
      product.name = structuredData.name || '';
      product.brand = structuredData.brand?.name || structuredData.brand || '';
      product.description = structuredData.description || '';
      
      if (structuredData.offers) {
        const offer = Array.isArray(structuredData.offers) ? structuredData.offers[0] : structuredData.offers;
        if (offer.price) {
          product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
        }
        product.inStock = offer.availability === 'http://schema.org/InStock' || 
                         offer.availability === 'https://schema.org/InStock';
      }
      
      if (structuredData.image) {
        if (typeof structuredData.image === 'string') {
          product.images.push(structuredData.image);
        } else if (Array.isArray(structuredData.image)) {
          product.images = structuredData.image;
        } else if (structuredData.image.url) {
          product.images.push(structuredData.image.url);
        }
      }
      
      // Extract additional properties
      if (structuredData.color) {
        product.color = structuredData.color;
      }
      if (structuredData.size) {
        product.size = structuredData.size;
      }
    }
    
    // Fallback to HTML scraping for missing data
    if (!product.name) {
      product.name = $('h1[data-test="listing-title"]').text().trim() ||
                     $('h1.listing__title').text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('title').text().split('|')[0].trim();
    }
    
    // Extract price
    if (!product.price) {
      const priceText = $('[data-test="listing-price"]').text().trim() ||
                        $('.listing__price').text().trim() ||
                        $('.price').first().text().trim();
      
      if (priceText) {
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = priceMatch[0];
        }
      }
    }
    
    // Ensure price has $ sign
    if (product.price && !product.price.startsWith('$')) {
      product.price = '$' + product.price;
    }
    
    // Extract original price (if on sale)
    const originalPriceText = $('[data-test="listing-original-price"]').text().trim() ||
                              $('.listing__original-price').text().trim() ||
                              $('s.price').text().trim();
    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/\$[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = originalMatch[0];
      }
    }
    
    // Extract brand - be more specific to avoid wrong matches
    if (!product.brand) {
      // Look for brand in specific locations
      const brandSelectors = [
        '[data-test="listing-brand"]',
        '.listing__brand',
        '[itemprop="brand"]',
        'meta[property="product:brand"]',
        'a[href*="/brand/"]:contains("Brand")'
      ];
      
      for (const selector of brandSelectors) {
        const brandText = selector.includes('meta') ? 
          $(selector).attr('content') : 
          $(selector).text().trim();
        
        if (brandText && !brandText.includes('lululemon')) { // Filter out navigation items
          product.brand = brandText;
          break;
        }
      }
      
      // Fallback: try to extract from title
      if (!product.brand && product.name) {
        // Common brand patterns in titles
        const brandMatch = product.name.match(/^([A-Z][A-Za-z'&\s]+?)(?:\s+[-–]|\s+[A-Z][a-z])/);
        if (brandMatch) {
          product.brand = brandMatch[1].trim();
        }
      }
    }
    
    // Clean up HTML entities in brand
    if (product.brand) {
      product.brand = product.brand
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
    
    // Extract images from various sources
    if (product.images.length === 0) {
      // Try carousel images
      $('.carousel__item img, .listing__image img, [data-test="listing-image"] img').each((i, img) => {
        let imageUrl = $(img).attr('src') || $(img).attr('data-src');
        if (imageUrl && !imageUrl.includes('placeholder')) {
          // Convert to full-size image if needed
          imageUrl = imageUrl.replace(/_m\./, '_l.').replace(/\?.*$/, '');
          if (!product.images.includes(imageUrl)) {
            product.images.push(imageUrl);
          }
        }
      });
      
      // Try from meta tags
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
    }
    
    // Extract size
    if (!product.size) {
      product.size = $('[data-test="listing-size"]').text().trim() ||
                     $('.listing__size').text().trim() ||
                     $('div:contains("Size:")').next().text().trim();
    }
    
    // Extract color
    if (!product.color) {
      product.color = $('[data-test="listing-color"]').text().trim() ||
                      $('.listing__color').text().trim() ||
                      $('div:contains("Color:")').next().text().trim();
    }
    
    // Extract condition
    product.condition = $('[data-test="listing-condition"]').text().trim() ||
                        $('.listing__condition').text().trim() ||
                        $('div:contains("Condition:")').next().text().trim() ||
                        'Pre-owned';
    
    // Extract category
    product.category = $('.breadcrumb__item').last().text().trim() ||
                       $('[data-test="listing-category"]').text().trim() ||
                       $('.listing__category').text().trim();
    
    // Extract seller
    product.seller = $('[data-test="seller-name"]').text().trim() ||
                     $('.seller__name').text().trim() ||
                     $('a[href*="/closet/"]').first().text().trim();
    
    // Extract description
    if (!product.description) {
      product.description = $('[data-test="listing-description"]').text().trim() ||
                            $('.listing__description').text().trim() ||
                            $('.description').text().trim();
    }
    
    // Extract additional details
    $('.listing__detail, .detail__item').each((i, detail) => {
      const text = $(detail).text().trim();
      if (text && !product.details.includes(text)) {
        product.details.push(text);
      }
    });
    
    // Check if sold
    const soldIndicator = $('.sold-banner').text().trim() ||
                          $('[data-test="sold-label"]').text().trim();
    if (soldIndicator && soldIndicator.toLowerCase().includes('sold')) {
      product.inStock = false;
    }
    
    // Parse NextJS data if available
    const nextDataScript = $('#__NEXT_DATA__');
    if (nextDataScript.length) {
      try {
        const nextData = JSON.parse(nextDataScript.html());
        const pageProps = nextData?.props?.pageProps;
        
        if (pageProps?.listing) {
          const listing = pageProps.listing;
          
          // Override with NextJS data if available
          product.name = product.name || listing.title || '';
          product.brand = product.brand || listing.brand || '';
          product.price = product.price || (listing.price ? `$${listing.price}` : '');
          product.size = product.size || listing.size || '';
          product.color = product.color || listing.color || '';
          product.condition = product.condition || listing.condition || '';
          product.description = product.description || listing.description || '';
          product.seller = product.seller || listing.seller?.username || '';
          
          // Extract images from NextJS data
          if (listing.pictures && Array.isArray(listing.pictures)) {
            listing.pictures.forEach(pic => {
              const imageUrl = pic.url || pic.image_url;
              if (imageUrl && !product.images.includes(imageUrl)) {
                product.images.push(imageUrl);
              }
            });
          }
          
          // Check availability
          if (listing.availability === 'sold' || listing.status === 'sold') {
            product.inStock = false;
          }
        }
      } catch (e) {
        console.log('Could not parse Next.js data:', e.message);
      }
    }
    
    // Clean up HTML entities in all string fields
    Object.keys(product).forEach(key => {
      if (typeof product[key] === 'string') {
        product[key] = product[key]
          .replace(/&amp;/g, '&')
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      }
    });
    
    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });
    
    console.log('✅ Successfully scraped Poshmark product:', product.name || 'Unknown');
    return product;
    
  } catch (error) {
    console.error('❌ Poshmark scraping error:', error.message);
    
    // Return partial data with error
    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapePoshmark };