const axios = require('axios');

// Universal redirect handler for affiliate links and URL shorteners
const handleRedirect = async (url) => {
  console.log('🔄 Starting redirect handler for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    
    let finalUrl = url;
    let redirectCount = 0;
    const maxRedirects = 10;
    
    // Follow redirects manually to get the final destination
    while (redirectCount < maxRedirects) {
      try {
        console.log(`🔍 Following redirect ${redirectCount + 1}...`);
        
        const response = await axios.get(finalUrl, {
          headers,
          maxRedirects: 0, // Don't follow redirects automatically
          validateStatus: (status) => status < 400,
          timeout: 10000
        });
        
        // Check if there's a redirect
        if (response.status >= 300 && response.status < 400) {
          const redirectUrl = response.headers.location;
          
          if (!redirectUrl) {
            console.log('No redirect location found');
            break;
          }
          
          // Handle relative redirects
          if (redirectUrl.startsWith('/')) {
            const urlObj = new URL(finalUrl);
            finalUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
          } else if (!redirectUrl.startsWith('http')) {
            const urlObj = new URL(finalUrl);
            finalUrl = `${urlObj.protocol}//${urlObj.host}/${redirectUrl}`;
          } else {
            finalUrl = redirectUrl;
          }
          
          console.log(`➡️ Redirecting to: ${finalUrl.substring(0, 80)}...`);
          redirectCount++;
        } else {
          // No more redirects
          break;
        }
      } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) {
          const redirectUrl = error.response.headers.location;
          if (redirectUrl) {
            finalUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, finalUrl).href;
            console.log(`➡️ Redirecting (from error) to: ${finalUrl.substring(0, 80)}...`);
            redirectCount++;
          } else {
            break;
          }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          // Final destination might be invalid
          console.log('❌ Final destination unreachable:', error.code);
          break;
        } else {
          // Some other error, try to continue
          break;
        }
      }
    }
    
    console.log(`✅ Final URL after ${redirectCount} redirects:`, finalUrl);
    
    // Check if we ended up at a valid product page
    if (finalUrl === url && redirectCount === 0) {
      console.log('⚠️ No redirects found, URL might be invalid');
      return {
        url,
        finalUrl,
        error: 'No redirect found',
        redirectCount: 0
      };
    }
    
    // Check if final URL is a known shopping site
    const hostname = new URL(finalUrl).hostname.toLowerCase();
    
    // Filter out non-product destinations
    const invalidDestinations = [
      'linksynergy.com',
      'shareasale.com',
      'shopstyle.com',
      'go.shopmy.us',
      'bit.ly',
      'tinyurl.com',
      'rstyle.me',
      'shopltk.com'
    ];
    
    for (const invalid of invalidDestinations) {
      if (hostname.includes(invalid)) {
        console.log('⚠️ Still on redirect/affiliate platform');
        return {
          url,
          finalUrl,
          error: 'Still on redirect platform',
          redirectCount
        };
      }
    }
    
    // Now scrape the actual product from the final URL
    console.log('🛍️ Scraping product from final destination...');
    
    // Temporarily modify the scrapeProduct to avoid infinite loop
    const productResult = await scrapeProductDirect(finalUrl);
    
    if (productResult.success) {
      // Add redirect info to the product
      productResult.product.originalUrl = url;
      productResult.product.finalUrl = finalUrl;
      productResult.product.redirectCount = redirectCount;
    }
    
    return productResult;
    
  } catch (error) {
    console.error('❌ Redirect handler error:', error.message);
    
    return {
      success: false,
      error: error.message,
      url,
      timestamp: new Date().toISOString()
    };
  }
};

// Direct product scraping without redirect detection
const scrapeProductDirect = async (url) => {
  // Import here to avoid circular dependency
  const { scrapeShopify, isShopifyStore } = require('./shopify');
  const { detectCategory } = require('../utils/categoryDetection');
  
  try {
    // Check if it's a Shopify store
    const isShopify = await isShopifyStore(url);
    
    if (isShopify) {
      console.log('✅ Detected as Shopify store');
      const shopifyProduct = await scrapeShopify(url);
      
      // Format the response
      let priceNumeric = 0;
      if (shopifyProduct.price) {
        const priceMatch = shopifyProduct.price.match(/[\d,]+\.?\d*/);
        priceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
      }
      
      return {
        success: !shopifyProduct.error,
        product: {
          ...shopifyProduct,
          product_name: shopifyProduct.name,
          brand: shopifyProduct.brand || shopifyProduct.vendor || 'Unknown',
          sale_price: priceNumeric,
          image_urls: shopifyProduct.images || [],
          vendor_url: url,
          category: detectCategory(
            shopifyProduct.name || '',
            shopifyProduct.description || '',
            shopifyProduct.brand || '',
            null
          )
        }
      };
    }
    
    // Try generic extraction
    console.log('📝 Using generic extraction...');
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    const product = {
      url,
      name: $('h1').first().text().trim() || 
            $('meta[property="og:title"]').attr('content') || 
            $('title').text().split('|')[0].trim(),
      brand: $('[itemprop="brand"]').text().trim() || 
             $('meta[property="product:brand"]').attr('content') || 
             new URL(url).hostname.replace('www.', '').split('.')[0],
      price: '',
      images: []
    };
    
    // Extract price
    const priceText = $('[itemprop="price"]').attr('content') || 
                      $('[itemprop="price"]').text().trim() ||
                      $('.price').first().text().trim();
    if (priceText) {
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        product.price = '$' + priceMatch[0];
      }
    }
    
    // Extract images
    const metaImage = $('meta[property="og:image"]').attr('content');
    if (metaImage) {
      product.images.push(metaImage);
    }
    
    $('img[itemprop="image"], .product-image img, .product-photo img').each((i, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && !src.includes('placeholder') && !product.images.includes(src)) {
        product.images.push(src);
      }
    });
    
    return {
      success: true,
      product: {
        ...product,
        product_name: product.name,
        brand: product.brand,
        sale_price: product.price ? parseFloat(product.price.replace(/[^0-9.]/g, '')) : 0,
        image_urls: product.images,
        vendor_url: url,
        category: detectCategory(product.name, '', product.brand, null)
      }
    };
    
  } catch (error) {
    console.error('Direct scraping error:', error.message);
    return {
      success: false,
      error: error.message,
      url
    };
  }
};

module.exports = { handleRedirect };