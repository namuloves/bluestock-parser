const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeWConcept(url) {
  try {
    console.log('🔍 Fetching W Concept page...');

    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5
    };

    // Get config with proxy if enabled
    const config = getAxiosConfig(url, baseConfig);

    // Make request
    const response = await axios.get(url, config);
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract from meta tags first (most reliable for W Concept)
    const metaTitle = $('meta[property="og:title"]').attr('content') || '';
    const metaImage = $('meta[property="og:image"]').attr('content') || '';
    const metaDescription = $('meta[property="og:description"]').attr('content') || '';
    const metaUrl = $('meta[property="og:url"]').attr('content') || url;

    // Extract product ID from URL
    const productIdMatch = url.match(/\/(\d+)\.html/);
    const productId = productIdMatch ? productIdMatch[1] : '';

    // Extract SKU from URL
    const skuMatch = url.match(/product\/[^\/]+\/(\d+)\.html/);
    const sku = skuMatch ? skuMatch[1] : productId;

    // Extract product name and clean it
    let productName = metaTitle;
    // Remove [SAMPLE SALE] or other prefixes
    productName = productName.replace(/\[.*?\]\s*/g, '').trim();

    // Extract color from product name (usually after dash)
    let color = '';
    const colorMatch = productName.match(/\s*-\s*(.+)$/);
    if (colorMatch) {
      color = colorMatch[1].trim();
      productName = productName.replace(/\s*-\s*.+$/, '').trim();
    }

    // Extract brand from various sources
    let brand = '';

    // Try to find brand in structured data
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('brand') && !brand) {
        // Look for brand patterns
        const brandMatch = scriptContent.match(/"brand"\s*:\s*"([^"]+)"/i) ||
                          scriptContent.match(/'brand'\s*:\s*'([^']+)'/i);
        if (brandMatch) {
          brand = brandMatch[1];
        }
      }
    });

    // Look for brand in page content
    if (!brand) {
      const brandElement = $('.brand_name, .product_brand, .pd_brand').first().text().trim();
      if (brandElement) {
        brand = brandElement;
      }
    }

    // Default to W Concept if no brand found
    if (!brand) {
      brand = 'W Concept';
    }

    // Build images array
    const images = [];

    // First try to extract from JavaScript/DOM if page is rendered
    let imageUrls = [];

    // Look for image arrays in script tags
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('image') && imageUrls.length === 0) {
        // Try to find image arrays in various formats
        const patterns = [
          /"images?"\s*:\s*\[(.*?)\]/g,
          /images?\s*:\s*\[(.*?)\]/g,
          /"productImages?"\s*:\s*\[(.*?)\]/g,
          /productImages?\s*=\s*\[(.*?)\]/g,
          /"gallery"\s*:\s*\[(.*?)\]/g,
          /gallery\s*:\s*\[(.*?)\]/g
        ];

        for (const pattern of patterns) {
          const matches = [...scriptContent.matchAll(pattern)];
          if (matches.length > 0) {
            try {
              // Extract URLs from the matched content
              const imageArrayContent = matches[0][1];
              const urlMatches = imageArrayContent.match(/https?:\/\/[^"'\s,\]]+\.(jpg|jpeg|png|webp)/gi);
              if (urlMatches && urlMatches.length > 0) {
                imageUrls = urlMatches;
                console.log(`📸 Found ${urlMatches.length} images in script tag`);
                break;
              }
            } catch (e) {
              // Continue to next pattern
            }
          }
        }

        // Also look for individual image URLs in scripts
        if (imageUrls.length === 0) {
          const individualUrls = scriptContent.match(/https?:\/\/cdn\.wconcept\.com\/products\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
          if (individualUrls && individualUrls.length > 1) {
            // Remove duplicates and sort
            imageUrls = [...new Set(individualUrls)].sort();
            console.log(`📸 Found ${imageUrls.length} individual image URLs in script`);
          }
        }
      }
    });

    // If we found images in JS, use those
    if (imageUrls.length > 0) {
      images.push(...imageUrls);
    } else if (metaImage) {
      // Start with meta image
      images.push(metaImage);

      // Try to verify additional images exist using wconcept's pattern
      const productImageBase = metaImage.match(/\/products\/(\d+)\/(\d+)\/(\d+)_/);

      if (productImageBase) {
        const [fullMatch, part1, part2, productCode] = productImageBase;
        const potentialImages = [];

        // Generate potential URLs based on wconcept's pattern
        for (let i = 2; i <= 8; i++) {
          const imageUrl = `https://cdn.wconcept.com/products/${part1}/${part2}/${productCode}_${i}.jpg`;
          potentialImages.push(imageUrl);
        }

        // Validate images exist (quick HEAD requests)
        console.log(`🔍 Validating ${potentialImages.length} potential images...`);
        const validationPromises = potentialImages.map(async (url) => {
          try {
            const response = await axios.head(url, { timeout: 3000 });
            return response.status === 200 ? url : null;
          } catch (error) {
            return null;
          }
        });

        try {
          const validatedResults = await Promise.all(validationPromises);
          const validImages = validatedResults.filter(url => url !== null);
          images.push(...validImages);
          console.log(`📸 Found ${validImages.length} additional valid images`);
        } catch (error) {
          console.log('⚠️ Image validation failed, using pattern-based approach');
          // Fallback to adding first few without validation
          images.push(potentialImages[0], potentialImages[1]);
        }
      }
    }

    // Try to extract price from page
    let price = 0;
    let originalPrice = 0;
    let currency = 'USD';

    // Look for price in various elements
    const priceSelectors = [
      '.price-now',
      '.sale-price',
      '.product-price',
      '.pd_price',
      '.price_now',
      '.price',
      '[data-price]'
    ];

    for (const selector of priceSelectors) {
      const priceElement = $(selector).first();
      if (priceElement.length) {
        const priceText = priceElement.text().trim();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(/,/g, ''));
          // Check if it's in KRW (Korean Won) - typically large numbers
          if (price > 10000) {
            currency = 'KRW';
          }
          break;
        }
      }
    }

    // Look for original price
    const originalPriceSelectors = [
      '.price-was',
      '.original-price',
      '.price_origin',
      '.price_before'
    ];

    for (const selector of originalPriceSelectors) {
      const originalPriceElement = $(selector).first();
      if (originalPriceElement.length) {
        const originalPriceText = originalPriceElement.text().trim();
        const originalPriceMatch = originalPriceText.match(/[\d,]+\.?\d*/);
        if (originalPriceMatch) {
          originalPrice = parseFloat(originalPriceMatch[0].replace(/,/g, ''));
          break;
        }
      }
    }

    // If no original price found, use the current price
    if (!originalPrice) {
      originalPrice = price;
    }

    // Extract sizes
    const sizes = [];
    $('select[name*="size"] option, .size-selector button, .size_option, input[name="size"]').each((i, elem) => {
      const size = $(elem).val() || $(elem).text().trim() || $(elem).attr('value');
      if (size && size !== 'Size' && size !== '사이즈' && !sizes.includes(size)) {
        sizes.push(size);
      }
    });

    // Try to get in-stock status
    let inStock = true;
    const stockText = $('.out-of-stock, .sold-out, .soldout').text().trim();
    if (stockText) {
      inStock = false;
    }

    // Check for sale status
    const isOnSale = originalPrice > price || metaTitle.includes('SALE') || $('.sale-badge, .discount-badge').length > 0;

    // Build product data
    const productData = {
      name: productName,
      price: price || 0,
      originalPrice: originalPrice || price || 0,
      images: images,
      description: metaDescription,
      sizes: sizes,
      color: color,
      sku: sku,
      brand: brand,
      category: '',
      isOnSale: isOnSale,
      inStock: inStock,
      url: url,
      currency: currency,
      productId: productId
    };

    // If price is still 0, this might be a JavaScript-rendered page
    if (price === 0) {
      // Look for price in script tags
      $('script').each((i, elem) => {
        const scriptContent = $(elem).html();
        if (scriptContent && !productData.price) {
          // Look for price patterns in JavaScript
          const pricePatterns = [
            /"price"\s*:\s*([\d.]+)/,
            /'price'\s*:\s*([\d.]+)/,
            /price\s*=\s*([\d.]+)/,
            /salePrice['"]\s*:\s*['"]([\d,]+)/
          ];

          for (const pattern of pricePatterns) {
            const match = scriptContent.match(pattern);
            if (match) {
              const extractedPrice = parseFloat(match[1].replace(/,/g, ''));
              if (extractedPrice > 0) {
                productData.price = extractedPrice;
                if (!productData.originalPrice || productData.originalPrice === 0) {
                  productData.originalPrice = extractedPrice;
                }
                // Check if it's KRW
                if (extractedPrice > 10000) {
                  productData.currency = 'KRW';
                }
                break;
              }
            }
          }
        }
      });
    }

    // Convert KRW to USD if needed (approximate conversion)
    if (productData.currency === 'KRW' && productData.price > 0) {
      // Rough conversion rate: 1 USD = 1300 KRW
      productData.priceKRW = productData.price;
      productData.originalPriceKRW = productData.originalPrice;
      productData.price = Math.round(productData.price / 1300 * 100) / 100;
      productData.originalPrice = Math.round(productData.originalPrice / 1300 * 100) / 100;
      productData.currency = 'USD';
      productData.currencyNote = 'Converted from KRW';
    }

    console.log('✅ Successfully scraped W Concept product');
    return productData;

  } catch (error) {
    console.error('W Concept scraper error:', error.message);

    // Return minimal data with error
    return {
      name: 'W Concept Product',
      price: 0,
      originalPrice: null,
      images: [],
      description: 'Unable to fetch product details',
      sizes: [],
      color: '',
      sku: '',
      brand: 'W Concept',
      category: '',
      isOnSale: false,
      inStock: false,
      url: url,
      error: error.message,
      needsPuppeteer: true // Indicate that this site might need Puppeteer
    };
  }
}

module.exports = { scrapeWConcept };