const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGalleryDept(url) {
  console.log('🎨 Starting Gallery Dept scraper for:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);

    // Initialize product object
    const product = {
      product_name: '',
      brand: 'GALLERY DEPT',
      sale_price: null,
      original_price: null,
      description: '',
      image_urls: [],
      sizes: [],
      colors: [],
      in_stock: false,
      product_url: url,
      currency: 'USD'
    };

    // Extract product name
    product.product_name = $('h1.product__title, .product__title h1, h1[class*="product-title"]').text().trim() ||
                          $('meta[property="og:title"]').attr('content')?.trim() || '';

    // Extract price - look for meta tag first
    const metaPrice = $('meta[property="og:price:amount"], meta[property="product:price:amount"]').attr('content');
    if (metaPrice) {
      // Meta price might have comma (e.g., "1,195")
      product.sale_price = parseFloat(metaPrice.replace(/,/g, ''));
      product.original_price = product.sale_price;
    } else {
      // Fallback to text extraction
      const priceText = $('.price__regular .price-item--regular, .product__price .price, .price-item').first().text();
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        product.sale_price = parseFloat(priceMatch[0].replace(/,/g, ''));
        product.original_price = product.sale_price;
      }
    }

    // Check for sale price
    const salePriceText = $('.price__sale .price-item--sale, .price--on-sale .price-item--sale').text();
    if (salePriceText) {
      const salePriceMatch = salePriceText.match(/[\d,]+\.?\d*/);
      if (salePriceMatch) {
        product.sale_price = parseFloat(salePriceMatch[0].replace(/,/g, ''));
      }

      const originalPriceText = $('.price__sale .price-item--regular, .price--on-sale .price-item--regular').text();
      const originalPriceMatch = originalPriceText.match(/[\d,]+\.?\d*/);
      if (originalPriceMatch) {
        product.original_price = parseFloat(originalPriceMatch[0].replace(/,/g, ''));
      }
    }

    // Extract description
    product.description = $('.product__description, .product-single__description, [class*="product-description"]').text().trim();

    // Extract images
    $('.product__media img, .product-single__photo img, .product__main-photos img').each((i, img) => {
      let imgUrl = $(img).attr('src') || $(img).attr('data-src');
      if (imgUrl) {
        // Clean up the URL
        imgUrl = imgUrl.replace(/\{width\}x/, '1800x'); // Replace width placeholder
        if (!imgUrl.startsWith('http')) {
          imgUrl = 'https:' + imgUrl;
        }
        // Remove duplicates and add to array
        if (!product.image_urls.includes(imgUrl)) {
          product.image_urls.push(imgUrl);
        }
      }
    });

    // Extract sizes - Gallery Dept uses fieldsets for variants
    const sizeData = {
      waist: [],
      inseam: []
    };

    // Look for waist sizes
    $('fieldset').each((i, fieldset) => {
      const legend = $(fieldset).find('legend').text().toLowerCase();

      if (legend.includes('waist')) {
        $(fieldset).find('input[type="radio"] + label').each((j, label) => {
          const size = $(label).text().trim();
          if (size && !$(label).prev('input').attr('disabled')) {
            sizeData.waist.push(size);
          }
        });
      } else if (legend.includes('inseam')) {
        $(fieldset).find('input[type="radio"] + label').each((j, label) => {
          const size = $(label).text().trim();
          if (size && !$(label).prev('input').attr('disabled')) {
            sizeData.inseam.push(size);
          }
        });
      } else if (legend.includes('size')) {
        // Generic size fieldset
        $(fieldset).find('input[type="radio"] + label').each((j, label) => {
          const size = $(label).text().trim();
          if (size && !$(label).prev('input').attr('disabled')) {
            product.sizes.push(size);
          }
        });
      } else if (legend.includes('color')) {
        // Color options
        $(fieldset).find('input[type="radio"] + label').each((j, label) => {
          const color = $(label).text().trim();
          if (color && !$(label).prev('input').attr('disabled')) {
            product.colors.push(color);
          }
        });
      }
    });

    // Combine waist and inseam if both exist
    if (sizeData.waist.length > 0) {
      if (sizeData.inseam.length > 0) {
        // Format as "Waist x Inseam"
        product.sizes = sizeData.waist.map(w => `${w}W`);
        product.sizes.push(...sizeData.inseam.map(i => `${i}L`));
      } else {
        product.sizes = sizeData.waist;
      }
    }

    // Try to extract from inline script with variant data
    $('script:not([type]), script[type="text/javascript"]').each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent && scriptContent.includes('variants') && scriptContent.includes('price')) {
        // Look for price in the script
        if (!product.sale_price) {
          const priceMatch = scriptContent.match(/"price":\s*\{\s*"amount":\s*([\d.]+)/);
          if (priceMatch) {
            product.sale_price = parseFloat(priceMatch[1]);
            product.original_price = product.sale_price;
          }
        }

        // Look for images in the script
        const imageMatches = scriptContent.match(/\/\/gallerydept\.com\/cdn\/shop\/files\/[^"'\\s]+\.jpg/g);
        if (imageMatches && product.image_urls.length === 0) {
          imageMatches.forEach(img => {
            const cleanImg = 'https:' + img.split('?')[0] + '?v=1702405000&width=1800';
            if (!product.image_urls.includes(cleanImg)) {
              product.image_urls.push(cleanImg);
            }
          });
        }
      }
    });

    // Try to extract from Shopify product JSON if available
    $('script[type="application/json"]').each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent && scriptContent.includes('product')) {
        try {
          const jsonData = JSON.parse(scriptContent);

          // Extract from Shopify product data
          if (jsonData.product) {
            if (!product.product_name && jsonData.product.title) {
              product.product_name = jsonData.product.title;
            }
            if (!product.description && jsonData.product.description) {
              product.description = jsonData.product.description;
            }

            // Extract variants for sizes
            if (jsonData.product.variants && product.sizes.length === 0) {
              jsonData.product.variants.forEach(variant => {
                if (variant.available && variant.title) {
                  const variantTitle = variant.title;
                  if (!product.sizes.includes(variantTitle)) {
                    product.sizes.push(variantTitle);
                  }
                }
              });
            }

            // Extract images
            if (jsonData.product.images && product.image_urls.length === 0) {
              jsonData.product.images.forEach(img => {
                if (img.src || img) {
                  const imgUrl = (img.src || img).replace(/\{width\}x/, '1800x');
                  if (!product.image_urls.includes(imgUrl)) {
                    product.image_urls.push(imgUrl);
                  }
                }
              });
            }
          }
        } catch (e) {
          // JSON parsing failed, continue
        }
      }
    });

    // Check stock status
    product.in_stock = !$('.sold-out, .product__text--sold-out').length;

    // Clean up the data
    product.sizes = [...new Set(product.sizes)]; // Remove duplicates
    product.colors = [...new Set(product.colors)];
    product.image_urls = product.image_urls.slice(0, 10); // Limit to 10 images

    console.log(`✅ Successfully scraped Gallery Dept product: ${product.product_name}`);
    console.log(`   Found ${product.image_urls.length} images, ${product.sizes.length} sizes`);

    return {
      success: true,
      product
    };

  } catch (error) {
    console.error('❌ Error scraping Gallery Dept:', error.message);

    // If axios fails, might need Puppeteer
    if (error.response?.status === 403 || error.message.includes('timeout')) {
      return {
        success: false,
        needsPuppeteer: true,
        error: 'Gallery Dept requires Puppeteer for scraping'
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { scrapeGalleryDept };