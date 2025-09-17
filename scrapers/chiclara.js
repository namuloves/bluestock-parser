const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeChiclara(url) {
  console.log('🛍️ Starting Chiclara scraper for:', url);

  let browser;
  try {
    // Launch Puppeteer for dynamic content
    console.log('🚀 Launching Puppeteer for Chiclara...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to the page
    console.log('📄 Loading page...');

    // Set up request interception to track loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Allow all requests
      request.continue();
    });

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (navError) {
      console.log('⚠️ Navigation timeout, but continuing to extract data...');
    }

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to wait for product data to load
    await page.waitForSelector('[data-product-json], script[type="application/ld+json"], .product__info, .product', { timeout: 5000 }).catch(() => {
      console.log('⚠️ Could not find product selectors, continuing anyway...');
    });

    // Get page content
    const html = await page.content();
    const $ = cheerio.load(html);

    // Initialize product object
    const product = {
      product_name: '',
      brand: 'CHICLARA',
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

    // Try to get Shopify product JSON first
    let productData = null;

    // Method 1: Look for Shopify product JSON in script tags
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('product') && scriptContent.includes('variants')) {
        try {
          // Try to extract product object
          const productMatch = scriptContent.match(/var\s+product\s*=\s*({[\s\S]*?});/);
          if (productMatch) {
            productData = JSON.parse(productMatch[1]);
          }
        } catch (e) {}
      }
    });

    // Method 2: Look for data attributes
    if (!productData) {
      const productJson = $('[data-product-json]').html();
      if (productJson) {
        try {
          productData = JSON.parse(productJson);
        } catch (e) {}
      }
    }

    // Method 3: Look for structured data
    if (!productData) {
      $('script[type="application/ld+json"]').each((i, elem) => {
        try {
          const jsonData = JSON.parse($(elem).html());
          if (jsonData['@type'] === 'Product' || (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Product'))) {
            const productInfo = Array.isArray(jsonData) ? jsonData.find(item => item['@type'] === 'Product') : jsonData;
            if (productInfo) {
              product.product_name = productInfo.name || product.product_name;
              product.brand = productInfo.brand?.name || 'CHICLARA';
              product.description = productInfo.description || product.description;

              if (productInfo.offers) {
                const offer = Array.isArray(productInfo.offers) ? productInfo.offers[0] : productInfo.offers;
                product.sale_price = parseFloat(offer.price) || product.sale_price;
                product.currency = offer.priceCurrency || product.currency;
                product.in_stock = offer.availability === 'https://schema.org/InStock';
              }

              if (productInfo.image) {
                const images = Array.isArray(productInfo.image) ? productInfo.image : [productInfo.image];
                product.image_urls = images.map(img => {
                  if (typeof img === 'string') return img.startsWith('http') ? img : `https:${img}`;
                  return img.url ? (img.url.startsWith('http') ? img.url : `https:${img.url}`) : '';
                }).filter(Boolean);
              }
            }
          }
        } catch (e) {}
      });
    }

    // Extract product information from productData if found
    if (productData) {
      product.product_name = productData.title || product.product_name;
      product.description = productData.description || product.description;

      // Extract variants for sizes/colors
      if (productData.variants && Array.isArray(productData.variants)) {
        const sizes = new Set();
        const colors = new Set();

        productData.variants.forEach(variant => {
          if (variant.available) {
            if (variant.option1) sizes.add(variant.option1);
            if (variant.option2) colors.add(variant.option2);
            if (variant.option3) colors.add(variant.option3);

            // Get price from first available variant
            if (!product.sale_price && variant.price) {
              product.sale_price = parseFloat(variant.price) / 100;
            }
            if (!product.original_price && variant.compare_at_price) {
              product.original_price = parseFloat(variant.compare_at_price) / 100;
            }
          }
        });

        product.sizes = Array.from(sizes).filter(Boolean);
        product.colors = Array.from(colors).filter(Boolean);
        product.in_stock = productData.available || false;
      }

      // Extract images
      if (productData.images && Array.isArray(productData.images)) {
        product.image_urls = productData.images.map(img => {
          if (typeof img === 'string') return img.startsWith('http') ? img : `https:${img}`;
          if (img.src) return img.src.startsWith('http') ? img.src : `https:${img.src}`;
          return '';
        }).filter(Boolean);
      } else if (productData.featured_image) {
        const imgUrl = productData.featured_image.startsWith('http') ?
          productData.featured_image : `https:${productData.featured_image}`;
        product.image_urls = [imgUrl];
      }
    }

    // Fallback: Extract from HTML if no JSON data or missing fields
    if (!product.product_name) {
      product.product_name = $('.product__title, h1[class*="product"], .product-title, h1').first().text().trim();
    }

    if (!product.sale_price) {
      // Look for price in various selectors
      const priceSelectors = [
        '.product__price .price-item--sale',
        '.product__price .price-item--regular',
        '.product-price .money',
        '.price .money',
        '[class*="price"] .money',
        '.product__price',
        '.price'
      ];

      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text();
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          product.sale_price = parseFloat(priceMatch[0].replace(',', ''));
          break;
        }
      }
    }

    if (!product.description) {
      product.description = $('.product__description, .product-description, [class*="description"]').first().text().trim();
    }

    // Extract images from HTML if not found in JSON
    if (product.image_urls.length === 0) {
      // Use page evaluation to get images more reliably
      const pageImages = await page.evaluate(() => {
        const images = [];

        // Get main product images
        document.querySelectorAll('.product__media-item img, .product__media img, .slick-slide img').forEach(img => {
          const src = img.src || img.dataset.src;
          if (src && !src.includes('blank.gif') && !src.includes('placeholder')) {
            images.push(src);
          }
        });

        return images;
      });

      // Process and add unique images
      pageImages.forEach(src => {
        const imgUrl = src.startsWith('http') ? src : `https:${src}`;
        // Keep the URL as is, don't remove parameters as they might be needed
        if (!product.image_urls.some(existing => existing.includes(imgUrl.split('?')[0]))) {
          product.image_urls.push(imgUrl);
        }
      });
    }

    // Extract sizes and colors from page
    if (product.sizes.length === 0 || product.colors.length === 0) {
      const variants = await page.evaluate(() => {
        const result = { sizes: [], colors: [] };

        // Look for select dropdowns
        document.querySelectorAll('select').forEach(select => {
          const name = select.name || select.id || '';
          const options = Array.from(select.options)
            .map(opt => opt.text.trim())
            .filter(text => text && text !== 'Title');

          if (name.toLowerCase().includes('size')) {
            result.sizes = options;
          } else if (name.toLowerCase().includes('color')) {
            result.colors = options;
          }
        });

        // Look for radio buttons/labels
        document.querySelectorAll('fieldset').forEach(fieldset => {
          const legend = fieldset.querySelector('legend')?.textContent?.toLowerCase() || '';
          const labels = Array.from(fieldset.querySelectorAll('input + label'))
            .map(label => label.textContent.trim());

          if (legend.includes('size') && labels.length > 0) {
            result.sizes = labels;
          } else if (legend.includes('color') && labels.length > 0) {
            result.colors = labels;
          }
        });

        // If still no luck, check the variant options more broadly
        if (result.sizes.length === 0 || result.colors.length === 0) {
          const allOptions = Array.from(document.querySelectorAll('select option'))
            .map(opt => opt.text.trim())
            .filter(text => text && text !== 'Title');

          // Common size patterns
          const sizePattern = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d+)$/i;
          const colorWords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'grey', 'gray', 'brown', 'navy', 'beige', 'apricot', 'army'];

          allOptions.forEach(option => {
            if (sizePattern.test(option) && !result.sizes.includes(option)) {
              result.sizes.push(option);
            } else if (colorWords.some(color => option.toLowerCase().includes(color)) && !result.colors.includes(option)) {
              result.colors.push(option);
            }
          });
        }

        return result;
      });

      if (product.sizes.length === 0 && variants.sizes.length > 0) {
        product.sizes = variants.sizes;
      }
      if (product.colors.length === 0 && variants.colors.length > 0) {
        product.colors = variants.colors;
      }
    }

    // Set original price if not found
    if (!product.original_price) {
      product.original_price = product.sale_price;
    }

    // Check stock status
    if (!product.in_stock) {
      product.in_stock = !$('.sold-out, .out-of-stock, [class*="sold-out"]').length;
    }

    console.log(`✅ Successfully scraped Chiclara product: ${product.product_name}`);
    console.log(`   Found ${product.image_urls.length} images, ${product.sizes.length} sizes, ${product.colors.length} colors`);

    return {
      success: true,
      product
    };

  } catch (error) {
    console.error('❌ Error scraping Chiclara:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeChiclara };