const axios = require('axios');
const cheerio = require('cheerio');

async function debugNepenthes() {
  const url = 'https://nepenthesny.com/products/rhodolirion-watch-cap-with-bow-black';

  console.log('🔍 Debugging Nepenthes NY page:', url);
  console.log('═'.repeat(60));

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Check for JSON-LD
    console.log('\n📊 JSON-LD Data:');
    let hasJsonLd = false;
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        console.log(`\nJSON-LD #${i + 1}:`, JSON.stringify(json, null, 2).substring(0, 1500));
        hasJsonLd = true;
      } catch (e) {
        console.error(`Failed to parse JSON-LD #${i + 1}:`, e.message);
      }
    });
    if (!hasJsonLd) {
      console.log('❌ No JSON-LD found');
    }

    // Check meta tags
    console.log('\n🏷️ Meta Tags:');
    const metaTags = {
      'og:title': $('meta[property="og:title"]').attr('content'),
      'og:price:amount': $('meta[property="og:price:amount"]').attr('content'),
      'og:price:currency': $('meta[property="og:price:currency"]').attr('content'),
      'og:image': $('meta[property="og:image"]').attr('content'),
      'og:description': $('meta[property="og:description"]').attr('content'),
      'product:price:amount': $('meta[property="product:price:amount"]').attr('content'),
      'product:price:currency': $('meta[property="product:price:currency"]').attr('content')
    };

    Object.entries(metaTags).forEach(([key, value]) => {
      if (value) {
        console.log(`${key}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
      }
    });

    // Check for price elements
    console.log('\n💰 Price Elements:');
    const priceSelectors = [
      '.price',
      '.product-price',
      '[data-price]',
      '.price-item',
      'span[class*="price"]',
      'div[class*="price"]',
      '.product__price',
      '.product-info__price',
      '.money',
      '[data-product-price]',
      '.current_price',
      '.product-single__price'
    ];

    let priceFound = false;
    priceSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        priceFound = true;
        console.log(`\n✅ ${selector}: ${elements.length} found`);
        elements.slice(0, 2).each((i, elem) => {
          const text = $(elem).text().trim();
          const dataPrice = $(elem).attr('data-price');
          if (text || dataPrice) {
            console.log(`   [${i}] text="${text}" data-price="${dataPrice || 'N/A'}"`);
          }
        });
      }
    });

    if (!priceFound) {
      console.log('❌ No price elements found with standard selectors');

      // Try to find any element with dollar sign
      console.log('\n🔍 Searching for any element with $ sign:');
      $('*').each(function() {
        const text = $(this).text().trim();
        if (text.match(/^\$[\d,]+\.?\d*$/) && $(this).children().length === 0) {
          console.log(`Found: "${text}" in <${this.name}> with class="${$(this).attr('class')}"`);
        }
      });
    }

    // Check for product name
    console.log('\n📦 Product Name Elements:');
    const nameSelectors = [
      'h1',
      '.product-title',
      '.product-name',
      '.product__title',
      '.product-single__title',
      '[data-product-title]',
      '.product-info__title'
    ];

    nameSelectors.forEach(selector => {
      const elem = $(selector).first();
      if (elem.length > 0) {
        const text = elem.text().trim();
        if (text) {
          console.log(`✅ ${selector}: "${text}"`);
        }
      }
    });

    // Check for images
    console.log('\n🖼️ Image Elements:');
    const imageSelectors = [
      '.product__media img',
      '.product-image img',
      '.product__image img',
      '.product-photo img',
      '.product-single__photo img',
      '[data-product-image] img',
      '.media img',
      'img[data-zoom]',
      'img[data-image]'
    ];

    let imagesFound = false;
    imageSelectors.forEach(selector => {
      const imgs = $(selector);
      if (imgs.length > 0) {
        imagesFound = true;
        console.log(`\n✅ ${selector}: ${imgs.length} found`);
        imgs.slice(0, 2).each((i, elem) => {
          const src = $(elem).attr('src') || $(elem).attr('data-src');
          if (src) {
            console.log(`   [${i}] ${src.substring(0, 80)}...`);
          }
        });
      }
    });

    if (!imagesFound) {
      console.log('❌ No images found with standard selectors');

      // Look for any images
      console.log('\n🔍 All img tags:');
      $('img').slice(0, 5).each((i, elem) => {
        const src = $(elem).attr('src');
        const className = $(elem).attr('class');
        if (src && !src.includes('logo') && !src.includes('icon')) {
          console.log(`   img class="${className}" src="${src.substring(0, 60)}..."`);
        }
      });
    }

    // Check if it's a Shopify site
    console.log('\n🛍️ Platform Detection:');
    const isShopify = html.includes('cdn.shopify.com') || html.includes('Shopify.theme');
    if (isShopify) {
      console.log('✅ This is a Shopify site');

      // Look for Shopify-specific data
      console.log('\nShopify-specific elements:');

      // Check for Shopify product object
      const shopifyProductScript = $('script').filter(function() {
        return $(this).html().includes('var meta = ') || $(this).html().includes('window.ShopifyAnalytics');
      });

      if (shopifyProductScript.length > 0) {
        console.log('✅ Found Shopify analytics/meta script');
      }

      // Look for variant selectors
      const variantSelectors = $('select[name="id"], input[name="id"][type="hidden"], .product-form__variants');
      if (variantSelectors.length > 0) {
        console.log(`✅ Found variant selectors: ${variantSelectors.length}`);
      }
    }

    // Check for specific Nepenthes selectors by examining the actual HTML structure
    console.log('\n🔬 Examining actual HTML structure:');

    // Try to find the main product container
    const productContainers = [
      '.product',
      '.product-single',
      '.product-template',
      '[data-section-type="product"]',
      'main[role="main"]'
    ];

    productContainers.forEach(selector => {
      const container = $(selector);
      if (container.length > 0) {
        console.log(`\n✅ Found container: ${selector}`);

        // Look for price within this container
        const priceInContainer = container.find('*').filter(function() {
          const text = $(this).text().trim();
          return text.match(/^\$[\d,]+\.?\d*$/) && $(this).children().length === 0;
        });

        if (priceInContainer.length > 0) {
          priceInContainer.each((i, elem) => {
            console.log(`   Price found: "${$(elem).text().trim()}" with class="${$(elem).attr('class')}"`);
          });
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugNepenthes();