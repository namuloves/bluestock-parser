const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeMiuMiu = async (url) => {
  console.log('👜 Starting Miu Miu scraper for:', url);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.miumiu.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
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
      brand: 'Miu Miu',
      sizes: [],
      colors: [],
      inStock: true,
      sku: '',
      category: '',
      material: ''
    };

    // Extract product code from URL
    const urlMatch = url.match(/\/([A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*)/);
    const productCode = urlMatch ? urlMatch[1] : null;
    product.sku = productCode || '';

    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());

        // Handle single product or array of products
        const products = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const item of products) {
          if (item['@type'] === 'Product') {
            product.name = item.name || product.name;
            product.description = item.description || product.description;
            product.sku = item.sku || product.sku;

            if (item.brand) {
              product.brand = typeof item.brand === 'string' ? item.brand : (item.brand.name || 'Miu Miu');
            }

            if (item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              const offer = offers[0];

              if (offer.price) {
                const price = typeof offer.price === 'string' ? offer.price : offer.price.toString();
                product.price = price.includes('.') || price.includes(',') ? price : `${price}`;
              }

              product.currency = offer.priceCurrency || 'EUR';
              product.inStock = offer.availability?.includes('InStock') !== false;
            }

            if (item.image) {
              if (typeof item.image === 'string') {
                product.images.push(item.image);
              } else if (Array.isArray(item.image)) {
                product.images.push(...item.image);
              } else if (item.image.url) {
                product.images.push(item.image.url);
              }
            }

            if (item.color) {
              product.colors.push(item.color);
            }

            if (item.material) {
              product.material = item.material;
            }
          }
        }
      } catch (e) {
        console.log('Failed to parse JSON-LD:', e.message);
      }
    });

    // HTML fallbacks and enhancements
    if (!product.name) {
      product.name = $('h1.product-name').text().trim() ||
                     $('h1[itemprop="name"]').text().trim() ||
                     $('.product-title').text().trim() ||
                     $('h1').first().text().trim() ||
                     $('meta[property="og:title"]').attr('content') || '';
    }

    if (!product.price) {
      // Miu Miu specific selectors
      const priceText = $('.product-price').text().trim() ||
                        $('.price-sales').text().trim() ||
                        $('[data-price]').attr('data-price') ||
                        $('.product-price-value').text().trim() ||
                        $('[itemprop="price"]').text().trim() ||
                        $('.price').first().text().trim();

      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+(?:\.\d+)?/);
        if (priceMatch) {
          product.price = priceMatch[0];
        }
      }

      // Also check meta tags
      if (!product.price) {
        const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                         $('meta[name="product:price:amount"]').attr('content');
        if (metaPrice) {
          product.price = metaPrice;
        }
      }
    }

    if (!product.description) {
      product.description = $('.product-description').text().trim() ||
                            $('.product-details').text().trim() ||
                            $('[itemprop="description"]').text().trim() ||
                            $('.description-content').text().trim() ||
                            $('meta[property="og:description"]').attr('content') || '';
    }

    // Enhanced image extraction for Miu Miu
    if (product.images.length === 0) {
      // Try various image selectors
      const imageSelectors = [
        '.product-image img',
        '.product-gallery img',
        '.product-images img',
        '.product-carousel img',
        '.swiper-slide img',
        '[data-image]',
        'picture img',
        '.media-gallery img',
        'img[itemprop="image"]'
      ];

      imageSelectors.forEach(selector => {
        $(selector).each((i, img) => {
          let imageUrl = $(img).attr('src') ||
                         $(img).attr('data-src') ||
                         $(img).attr('data-lazy-src') ||
                         $(img).attr('data-original');

          if (imageUrl && !imageUrl.includes('placeholder') && !imageUrl.includes('loading')) {
            // Ensure full URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = 'https://www.miumiu.com' + imageUrl;
            }

            // Try to get high-res version
            imageUrl = imageUrl.replace(/\?.*$/, '') // Remove query params
                               .replace(/\/thumbnail\//, '/large/')
                               .replace(/_small/, '_large')
                               .replace(/_thumb/, '');

            if (!product.images.includes(imageUrl)) {
              product.images.push(imageUrl);
            }
          }
        });
      });

      // Try to extract from data attributes
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

      // Extract from srcset attributes
      $('img[srcset], source[srcset]').each((i, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
          const matches = srcset.match(/https?:\/\/[^\s,]+/g);
          if (matches) {
            matches.forEach(url => {
              if (!product.images.includes(url) && !url.includes('placeholder')) {
                product.images.push(url);
              }
            });
          }
        }
      });

      // Fallback to meta image
      if (product.images.length === 0) {
        const metaImage = $('meta[property="og:image"]').attr('content') ||
                         $('meta[property="og:image:secure_url"]').attr('content');
        if (metaImage) {
          product.images.push(metaImage);
        }
      }
    }

    // Sizes extraction
    $('.size-selector button, .size-option, select[name="size"] option, [data-size]').each((i, sizeEl) => {
      const size = $(sizeEl).text().trim() ||
                   $(sizeEl).val() ||
                   $(sizeEl).attr('data-size');

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

    // Extract material information
    if (!product.material) {
      const materialText = $('.product-material').text().trim() ||
                          $('.material-content').text().trim() ||
                          $('.product-composition').text().trim();
      if (materialText) {
        product.material = materialText;
      }
    }

    // Category extraction from breadcrumbs
    $('.breadcrumb a, nav[aria-label="breadcrumb"] a, .breadcrumbs a').each((i, breadcrumb) => {
      const text = $(breadcrumb).text().trim();
      if (text && !text.toLowerCase().includes('home') && !text.toLowerCase().includes('miu miu')) {
        product.category = text;
      }
    });

    // Remove duplicate images and filter out empty URLs
    product.images = [...new Set(product.images)].filter(url => url && url.length > 0);

    // Format price with currency
    if (product.price && product.currency) {
      const currencySymbol = product.currency === 'EUR' ? '€' :
                             product.currency === 'USD' ? '$' :
                             product.currency === 'GBP' ? '£' : '';
      if (currencySymbol && !product.price.includes(currencySymbol)) {
        product.price = `${currencySymbol}${product.price}`;
      }
    }

    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || (Array.isArray(product[key]) && product[key].length === 0)) {
        delete product[key];
      }
    });

    console.log(`✅ Successfully scraped Miu Miu product: ${product.name || 'Unknown'}`);
    console.log(`   Found ${product.images?.length || 0} images`);
    console.log(`   Price: ${product.price || 'Not found'}`);

    return {
      success: true,
      product
    };

  } catch (error) {
    console.error('❌ Miu Miu scraping error:', error.message);

    // If regular scraping fails due to bot protection, return with Puppeteer requirement
    if (error.message.includes('timeout') || error.response?.status === 403) {
      console.log('⚠️ Miu Miu requires Puppeteer fallback');
      return {
        success: false,
        needsPuppeteer: true,
        error: error.message,
        product: {
          url,
          brand: 'Miu Miu'
        }
      };
    }

    return {
      success: false,
      error: error.message,
      product: {
        url,
        brand: 'Miu Miu'
      }
    };
  }
};

module.exports = { scrapeMiuMiu };