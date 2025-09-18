const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

async function scrapeBoden(url) {
  try {
    console.log('🔍 Fetching Boden page...');

    const baseConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
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

    let productData = null;

    // Try to extract from JSON-LD first
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());

        // Look for Product type
        if (json['@type'] === 'Product') {
          // Extract basic info
          const name = json.name || '';
          const description = json.description || '';
          const brand = json.brand?.name || 'Boden';
          const sku = json.sku || json.productCode || '';

          // Extract images
          const images = [];
          if (json.image) {
            if (Array.isArray(json.image)) {
              json.image.forEach(img => {
                if (img && !img.includes('cdn/shop/t/')) { // Filter out tiny thumbnails
                  // Ensure high quality image
                  const highQualityUrl = img.replace(/\?.*$/, '?v=1&width=1920');
                  images.push(highQualityUrl);
                }
              });
            } else if (typeof json.image === 'string') {
              const highQualityUrl = json.image.replace(/\?.*$/, '?v=1&width=1920');
              images.push(highQualityUrl);
            }
          }

          // Extract price and availability from offers
          let price = 0;
          let originalPrice = null;
          let currency = 'USD';
          let inStock = false;
          const sizes = [];
          const offers = Array.isArray(json.offers) ? json.offers : (json.offers ? [json.offers] : []);

          if (offers.length > 0) {
            // Get price from first offer
            const firstOffer = offers[0];
            if (firstOffer.price) {
              price = parseFloat(firstOffer.price);
              currency = firstOffer.priceCurrency || 'USD';
            }

            // Check availability and collect sizes
            offers.forEach(offer => {
              if (offer.availability?.includes('InStock')) {
                inStock = true;
              }
              // Extract size from SKU (usually last part)
              if (offer.sku) {
                const sizeMatch = offer.sku.match(/(\d+)P$/);
                if (sizeMatch) {
                  const sizeNum = sizeMatch[1];
                  if (!sizes.includes(sizeNum)) {
                    sizes.push(sizeNum);
                  }
                }
              }
            });
          }

          // Sort sizes numerically
          sizes.sort((a, b) => parseInt(a) - parseInt(b));

          // Extract color from product name or URL
          let color = '';
          const nameMatch = name.match(/-(.+)$/);
          if (nameMatch) {
            color = nameMatch[1].trim();
          } else if (url.includes('-')) {
            const urlMatch = url.match(/[^/]+-([^/?]+)(?:\?|$)/);
            if (urlMatch) {
              color = urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1).toLowerCase();
            }
          }

          productData = {
            name: name.replace(/-.*$/, '').trim(), // Remove color from name
            price: price,
            originalPrice: originalPrice || price,
            images: images,
            description: description,
            sizes: sizes,
            color: color,
            sku: sku,
            brand: brand,
            category: '',
            isOnSale: originalPrice && originalPrice > price,
            inStock: inStock,
            url: url,
            currency: currency
          };
        }
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e.message);
      }
    });

    // Fallback to HTML parsing if no JSON-LD or need additional data
    if (!productData || productData.images.length === 0) {
      // Get images from gallery
      const images = [];
      $('.swiper-slide img, .product__media img').each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src && !src.includes('/cdn/shop/t/') && !src.includes('blank.gif')) {
          // Ensure it's a full URL
          let fullUrl = src.startsWith('//') ? 'https:' + src : src;
          // Ensure high quality
          fullUrl = fullUrl.replace(/\?.*$/, '?v=1&width=1920');
          if (!images.includes(fullUrl)) {
            images.push(fullUrl);
          }
        }
      });

      if (!productData) {
        // Extract product name
        const name = $('h1').first().text().trim().split('\n')[0].trim() ||
                     $('meta[property="og:title"]').attr('content') || '';

        // Extract price
        let price = 0;
        const priceText = $('.price-item--regular').first().text().trim() ||
                          $('.price').first().text().trim() ||
                          $('meta[property="og:price:amount"]').attr('content') || '';

        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(',', ''));
        }

        // Extract sizes
        const sizes = [];
        $('input[name="Size"], select[name="Size"] option, .size-selector button').each((i, elem) => {
          const size = $(elem).val() || $(elem).text().trim();
          if (size && size !== 'Size' && !sizes.includes(size)) {
            sizes.push(size);
          }
        });

        productData = {
          name: name.replace(/-.*$/, '').trim(),
          price: price,
          originalPrice: price,
          images: images,
          description: $('meta[property="og:description"]').attr('content') || '',
          sizes: sizes,
          color: '',
          sku: '',
          brand: 'Boden',
          category: '',
          isOnSale: false,
          inStock: true,
          url: url,
          currency: 'USD'
        };
      } else if (images.length > 0) {
        // Update images if we found more
        productData.images = images;
      }
    }

    // Check for sale price
    const salePrice = $('.price-item--sale').first().text().trim();
    if (salePrice) {
      const salePriceMatch = salePrice.match(/[\d,]+\.?\d*/);
      if (salePriceMatch) {
        const salePriceNum = parseFloat(salePriceMatch[0].replace(',', ''));
        if (salePriceNum < productData.price) {
          productData.originalPrice = productData.price;
          productData.price = salePriceNum;
          productData.isOnSale = true;
        }
      }
    }

    // Extract additional colors if available
    const colors = [];
    $('.color-swatch, .product-form__swatch').each((i, elem) => {
      const colorName = $(elem).attr('data-color') || $(elem).attr('title') || $(elem).text().trim();
      if (colorName && !colors.includes(colorName)) {
        colors.push(colorName);
      }
    });

    if (colors.length > 0) {
      productData.colors = colors;
    }

    console.log('✅ Successfully scraped Boden product');
    return productData;

  } catch (error) {
    console.error('Boden scraper error:', error.message);

    // Return minimal data with error
    return {
      name: 'Boden Product',
      price: 0,
      originalPrice: null,
      images: [],
      description: 'Unable to fetch product details',
      sizes: [],
      color: '',
      sku: '',
      brand: 'Boden',
      category: '',
      isOnSale: false,
      inStock: false,
      url: url,
      error: error.message
    };
  }
}

module.exports = { scrapeBoden };