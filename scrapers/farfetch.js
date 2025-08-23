const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');
const { scrapeFarfetchWithPuppeteer } = require('./farfetch-puppeteer');

const scrapeFarfetch = async (url) => {
  console.log('🛍️ Starting Farfetch scraper for:', url);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Referer': 'https://www.farfetch.com/',
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
      timeout: 20000,
      maxRedirects: 5
    });
    
    const response = await axios.get(url, axiosConfig);
    
    const $ = cheerio.load(response.data);
    
    const product = {
      url,
      name: '',
      price: 0,
      originalPrice: null,
      currency: 'USD',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      color: '',
      inStock: true,
      materials: [],
      productId: '',
      source: 'farfetch',
      scrapedAt: new Date().toISOString()
    };
    
    // Try JSON-LD structured data first
    let jsonLdData = null;
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'Product' || (Array.isArray(jsonData['@graph']) && jsonData['@graph'].find(item => item['@type'] === 'Product'))) {
          jsonLdData = jsonData['@type'] === 'Product' ? jsonData : jsonData['@graph'].find(item => item['@type'] === 'Product');
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Extract from JSON-LD if available
    if (jsonLdData) {
      product.name = jsonLdData.name || '';
      product.description = jsonLdData.description || '';
      product.productId = jsonLdData.sku || jsonLdData.productID || '';
      
      if (jsonLdData.brand) {
        product.brand = typeof jsonLdData.brand === 'object' ? jsonLdData.brand.name : jsonLdData.brand;
      }
      
      if (jsonLdData.image) {
        if (typeof jsonLdData.image === 'string') {
          product.images.push(jsonLdData.image);
        } else if (Array.isArray(jsonLdData.image)) {
          product.images = jsonLdData.image;
        } else if (jsonLdData.image.url) {
          product.images.push(jsonLdData.image.url);
        }
      }
      
      if (jsonLdData.offers) {
        const offers = Array.isArray(jsonLdData.offers) ? jsonLdData.offers[0] : jsonLdData.offers;
        if (offers.price) {
          product.price = parseFloat(offers.price) || 0;
        }
        if (offers.priceCurrency) {
          product.currency = offers.priceCurrency;
        }
        product.inStock = offers.availability?.includes('InStock') || false;
      }
      
      if (jsonLdData.color) {
        product.color = jsonLdData.color;
      }
    }
    
    // HTML fallbacks - Farfetch specific selectors
    if (!product.brand) {
      product.brand = $('[data-component="ProductBrandName"]').text().trim() ||
                      $('[data-tstid="productDetails-brand"]').text().trim() ||
                      $('h1[data-component="ProductDescription"] a').first().text().trim() ||
                      $('._d120b3 a').first().text().trim() ||
                      $('a[data-component="DesignerName"]').text().trim() ||
                      '';
    }
    
    if (!product.name) {
      product.name = $('[data-component="ProductDescription"]').text().trim() ||
                     $('[data-tstid="productDetails-description"]').text().trim() ||
                     $('h1[data-component="ProductDescription"] span').last().text().trim() ||
                     $('._3c3f42').text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     '';
      
      // Remove brand from name if it's included
      if (product.brand && product.name.startsWith(product.brand)) {
        product.name = product.name.replace(product.brand, '').trim();
      }
    }
    
    if (!product.price || product.price === 0) {
      // Get current price
      const priceText = $('[data-component="PriceLarge"]').text().trim() ||
                        $('[data-tstid="priceInfo-current"]').text().trim() ||
                        $('._ac3d1e').text().trim() ||
                        $('[data-component="Price"]').first().text().trim() ||
                        '';
      
      if (priceText) {
        // Extract numeric value from price text
        const priceMatch = priceText.match(/[\d,]+(?:\.\d{2})?/);
        if (priceMatch) {
          product.price = parseFloat(priceMatch[0].replace(/,/g, ''));
        }
        
        // Extract currency if present
        const currencyMatch = priceText.match(/[$£€¥₹]/);
        if (currencyMatch) {
          const currencyMap = {
            '$': 'USD',
            '£': 'GBP',
            '€': 'EUR',
            '¥': 'JPY',
            '₹': 'INR'
          };
          product.currency = currencyMap[currencyMatch[0]] || 'USD';
        }
      }
    }
    
    // Original price if on sale
    const originalPriceText = $('[data-component="PriceOriginal"]').text().trim() ||
                              $('[data-tstid="priceInfo-original"]').text().trim() ||
                              $('._1c7a96 s').text().trim() ||
                              '';
    
    if (originalPriceText) {
      const originalPriceMatch = originalPriceText.match(/[\d,]+(?:\.\d{2})?/);
      if (originalPriceMatch) {
        product.originalPrice = parseFloat(originalPriceMatch[0].replace(/,/g, ''));
      }
    }
    
    if (!product.description) {
      // Farfetch description is often in multiple parts
      const descParts = [];
      
      // Main description
      const mainDesc = $('[data-component="TabProductDetails"] p').text().trim() ||
                       $('[data-tstid="productDetails-description"]').text().trim() ||
                       $('._b4693b').text().trim() ||
                       '';
      if (mainDesc) descParts.push(mainDesc);
      
      // Additional details
      $('[data-component="Accordion"] [data-component="AccordionItem"]').each((i, el) => {
        const title = $(el).find('[data-component="AccordionItemTitle"]').text().trim();
        const content = $(el).find('[data-component="AccordionItemPanel"]').text().trim();
        if (title && content && !title.includes('Size') && !title.includes('Delivery')) {
          descParts.push(`${title}: ${content}`);
        }
      });
      
      product.description = descParts.join(' | ') || $('meta[property="og:description"]').attr('content') || '';
    }
    
    // Images - Farfetch specific
    if (product.images.length === 0) {
      // Main product images
      $('[data-component="ProductImageCarousel"] img, [data-component="ProductImage"] img, ._7e6893 img').each((i, img) => {
        let imageUrl = $(img).attr('src') || 
                       $(img).attr('data-src') || 
                       $(img).attr('data-image');
        
        if (imageUrl) {
          // Get high-res version by modifying URL parameters
          imageUrl = imageUrl.replace(/\?.*$/, '') // Remove existing params
                             .replace(/_\d+\./, '_1000.') // Request 1000px width
                             .replace(/^\/\//, 'https://'); // Ensure https
          
          // Farfetch CDN URLs
          if (imageUrl.includes('cdn-images.farfetch')) {
            imageUrl = imageUrl.replace(/width=\d+/, 'width=1000')
                               .replace(/height=\d+/, 'height=1334');
          }
          
          if (!product.images.includes(imageUrl) && imageUrl.includes('http')) {
            product.images.push(imageUrl);
          }
        }
      });
      
      // Try thumbnails if no main images found
      if (product.images.length === 0) {
        $('[data-component="ThumbnailsList"] img, ._1cb809 img').each((i, img) => {
          let imageUrl = $(img).attr('src') || $(img).attr('data-src');
          if (imageUrl) {
            imageUrl = imageUrl.replace(/\?.*$/, '')
                               .replace(/_\d+\./, '_1000.')
                               .replace(/^\/\//, 'https://');
            
            if (!product.images.includes(imageUrl) && imageUrl.includes('http')) {
              product.images.push(imageUrl);
            }
          }
        });
      }
      
      // Fallback to meta image
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
    }
    
    // Sizes - Farfetch has a sophisticated size selector
    $('[data-component="SizeSelector"] button, [data-tstid^="sizeButton-"], ._65f6bb button').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim() || 
                   $(sizeEl).attr('aria-label')?.replace('Size ', '').trim();
      const isAvailable = !$(sizeEl).hasClass('disabled') && 
                          !$(sizeEl).attr('disabled') &&
                          !$(sizeEl).hasClass('_41eca7'); // Out of stock class
      
      if (size && isAvailable && !product.sizes.includes(size)) {
        product.sizes.push(size);
      }
    });
    
    // Color extraction
    if (!product.color) {
      product.color = $('[data-component="ColourName"]').text().trim() ||
                      $('[data-tstid="productDetails-color"]').text().trim() ||
                      $('._c0f09e').text().trim() ||
                      '';
      
      // Try to extract from product name if not found
      if (!product.color && product.name) {
        const colorMatch = product.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan|khaki|olive|orange|burgundy|maroon|gold|silver)\b/i);
        if (colorMatch) {
          product.color = colorMatch[0].toLowerCase();
        }
      }
    }
    
    // Materials extraction
    const materialsText = $('[data-component="Composition"]').text().trim() ||
                          $('div:contains("Composition")').next().text().trim() ||
                          '';
    
    if (materialsText) {
      const materialMatches = materialsText.match(/(\d+%\s+\w+(?:\s+\w+)?)/g);
      if (materialMatches) {
        product.materials = materialMatches;
      }
    }
    
    // Product ID extraction
    if (!product.productId) {
      // Try to extract from URL
      const idMatch = url.match(/item-(\d+)/);
      if (idMatch) {
        product.productId = idMatch[1];
      } else {
        // Try from page data
        product.productId = $('[data-tstid="productDetails-id"]').text().trim() ||
                           $('[data-component="ProductId"]').text().trim() ||
                           '';
      }
    }
    
    // Clean up the product object
    if (!product.brand) product.brand = 'Unknown Brand';
    if (!product.name) product.name = 'Unknown Product';
    
    // If we didn't get good data, try with Puppeteer
    if (product.price === 0 || product.images.length === 0 || product.brand === 'Unknown Brand') {
      console.log('⚠️ Limited data from HTML scraping, trying Puppeteer...');
      return await scrapeFarfetchWithPuppeteer(url);
    }
    
    console.log('✅ Successfully scraped Farfetch product:', product.name);
    console.log('Brand:', product.brand);
    console.log('Price:', product.currency, product.price);
    console.log('Images found:', product.images.length);
    console.log('Sizes available:', product.sizes.length);
    
    return product;
    
  } catch (error) {
    console.error('❌ Farfetch scraping error:', error.message);
    
    // If axios fails, we might need to use Puppeteer
    if (error.response?.status === 403 || error.message.includes('403')) {
      console.log('⚠️ Farfetch might be blocking requests. Consider using Puppeteer fallback.');
      return {
        url,
        error: 'Access denied - may need Puppeteer',
        needsPuppeteer: true,
        source: 'farfetch'
      };
    }
    
    return {
      url,
      error: error.message,
      source: 'farfetch'
    };
  }
};

module.exports = { scrapeFarfetch };