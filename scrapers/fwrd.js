const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');
const { scrapeFWRDWithPuppeteer } = require('./fwrd-puppeteer');

const scrapeFWRD = async (url) => {
  console.log('🛍️ Starting FWRD scraper for:', url);

  // FWRD often requires Puppeteer due to anti-bot measures
  // Skip straight to Puppeteer for better success rate
  console.log('🔄 Falling back to Puppeteer for FWRD...');
  return await scrapeFWRDWithPuppeteer(url);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.fwrd.com/'
    };

    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5
    });

    const response = await axios.get(url, axiosConfig);
    const $ = cheerio.load(response.data);

    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: '',
      sizes: [],
      colors: [],
      inStock: true,
      sku: '',
      category: ''
    };

    // Extract product ID from URL for image generation
    const urlMatch = url.match(/\/([A-Z]+-[A-Z0-9]+)\//);
    const productCode = urlMatch ? urlMatch[1] : null;

    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());

        if (jsonData['@type'] === 'Product') {
          product.name = jsonData.name || '';
          product.description = jsonData.description || '';
          product.sku = jsonData.sku || productCode || '';

          if (jsonData.brand) {
            product.brand = typeof jsonData.brand === 'string' ? jsonData.brand : jsonData.brand.name;
          }

          if (jsonData.offers) {
            const offer = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            if (offer.price) {
              product.price = typeof offer.price === 'string' ? offer.price : `$${offer.price}`;
            }
            product.inStock = offer.availability?.includes('InStock') !== false;
            product.currency = offer.priceCurrency || 'USD';
          }

          // Get images from JSON-LD
          if (jsonData.image) {
            if (typeof jsonData.image === 'string') {
              product.images.push(jsonData.image);
            } else if (Array.isArray(jsonData.image)) {
              product.images.push(...jsonData.image);
            }
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    });

    // HTML fallbacks and enhancements
    if (!product.name) {
      product.name = $('.product-title').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('h1').first().text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }

    if (!product.brand) {
      product.brand = $('.product-brand').text().trim() ||
                      $('.designer-name').text().trim() ||
                      $('[itemprop="brand"]').text().trim() ||
                      $('.product-designer').text().trim() ||
                      'FWRD';
    }

    if (!product.price) {
      const priceText = $('.product-price').text().trim() ||
                        $('.price-current').text().trim() ||
                        $('[itemprop="price"]').text().trim() ||
                        $('.price').first().text().trim();

      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.price = `$${priceMatch[0]}`;
        }
      }
    }

    // Check for original price (sale items)
    const originalPriceText = $('.price-original').text().trim() ||
                              $('.price-was').text().trim() ||
                              $('span.strikethrough').text().trim();

    if (originalPriceText) {
      const originalMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalMatch) {
        product.originalPrice = `$${originalMatch[0]}`;
      }
    }

    if (!product.description) {
      product.description = $('.product-description').text().trim() ||
                            $('.product-details').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }

    // Enhanced image extraction for FWRD
    if (productCode) {
      // FWRD typically has a predictable image URL pattern
      // Format: https://is4.fwrdassets.com/images/p/fw/p/{PRODUCT_CODE}_V{VIEW}.jpg
      const baseImageUrl = `https://is4.fwrdassets.com/images/p/fw/p/${productCode}`;

      // Try to get multiple views (V1 through V6 typically)
      for (let i = 1; i <= 6; i++) {
        const imageUrl = `${baseImageUrl}_V${i}.jpg`;
        // We'll add all potential images, the frontend can handle 404s
        product.images.push(imageUrl);
      }

      // Also try zoom images with different format
      const zoomBaseUrl = `https://is4.fwrdassets.com/images/p/fw/z/${productCode}`;
      for (let i = 1; i <= 6; i++) {
        const zoomUrl = `${zoomBaseUrl}_V${i}.jpg`;
        product.images.push(zoomUrl);
      }
    }

    // Also extract any images found in the HTML
    $('.product-images img, .product-carousel img, .product-gallery img').each((i, img) => {
      let imageUrl = $(img).attr('src') ||
                     $(img).attr('data-src') ||
                     $(img).attr('data-zoom') ||
                     $(img).attr('data-image');

      if (imageUrl && !imageUrl.includes('placeholder') && !imageUrl.includes('loading')) {
        // Ensure full URL
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://www.fwrd.com' + imageUrl;
        }

        // Replace thumbnail with full-size image
        imageUrl = imageUrl.replace('/thumbnail/', '/p/')
                           .replace('_thumbnail', '')
                           .replace('_thumb', '')
                           .replace('/t/', '/p/');

        if (!product.images.includes(imageUrl)) {
          product.images.push(imageUrl);
        }
      }
    });

    // Extract from data attributes that might contain image URLs
    $('[data-images]').each((i, el) => {
      try {
        const imagesData = $(el).attr('data-images');
        if (imagesData) {
          const images = JSON.parse(imagesData);
          if (Array.isArray(images)) {
            images.forEach(img => {
              const imgUrl = img.url || img.src || img;
              if (typeof imgUrl === 'string' && !product.images.includes(imgUrl)) {
                product.images.push(imgUrl);
              }
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Sizes extraction
    $('.size-selector button, .size-option, select[name="size"] option').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim() || $(sizeEl).val();
      const isAvailable = !$(sizeEl).hasClass('disabled') &&
                          !$(sizeEl).hasClass('out-of-stock') &&
                          !$(sizeEl).attr('disabled');

      if (size && size !== 'Select Size' && !product.sizes.includes(size) && isAvailable) {
        product.sizes.push(size);
      }
    });

    // Colors extraction
    $('.color-option, .color-selector button, [data-color]').each((i, colorEl) => {
      const color = $(colorEl).attr('data-color') ||
                    $(colorEl).attr('title') ||
                    $(colorEl).attr('aria-label') ||
                    $(colorEl).text().trim();

      if (color && !product.colors.includes(color)) {
        product.colors.push(color);
      }
    });

    // Category extraction
    $('.breadcrumb a, nav[aria-label="breadcrumb"] a').each((i, breadcrumb) => {
      const text = $(breadcrumb).text().trim();
      if (text && !text.toLowerCase().includes('home') && !text.toLowerCase().includes('fwrd')) {
        product.category = text;
      }
    });

    // Remove duplicate images and filter out empty URLs
    product.images = [...new Set(product.images)].filter(url => url && url.length > 0);

    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });

    console.log(`✅ Successfully scraped FWRD product: ${product.name || 'Unknown'}`);
    console.log(`   Found ${product.images?.length || 0} images`);

    return {
      success: true,
      product
    };

  } catch (error) {
    console.error('❌ FWRD scraping error:', error.message);

    // If regular scraping fails, try with Puppeteer
    if (error.message.includes('timeout') || error.response?.status === 403) {
      console.log('🔄 Falling back to Puppeteer for FWRD...');
      return await scrapeFWRDWithPuppeteer(url);
    }

    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'FWRD'
      }
    };
  }
};

module.exports = { scrapeFWRD };