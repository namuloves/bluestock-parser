const UniversalParserV3 = require('./universal-parser-v3');

// Patch the parser to trace Shopify image extraction
class TracingParser extends UniversalParserV3 {
  extractShopifyImages($) {
    const images = [];

    // 1. First try to get images from og:image tags (often high quality)
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogImageUrl = $('meta[property="og:image:url"]').attr('content');

    // Process OG image - remove crop parameters for higher resolution
    const processShopifyImage = (url) => {
      if (!url || !url.includes('cdn.shopify.com')) return null;

      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);

      params.delete('width');
      params.delete('height');
      params.delete('crop');

      urlObj.search = params.toString();
      return urlObj.toString();
    };

    // Add processed OG image
    if (ogImageUrl) {
      const processed = processShopifyImage(ogImageUrl);
      if (processed) {
        console.log(`✅ From og:image:url - ${processed}`);
        images.push(processed);
      }
    } else if (ogImage) {
      const processed = processShopifyImage(ogImage);
      if (processed) {
        console.log(`✅ From og:image - ${processed}`);
        images.push(processed);
      }
    }

    // 2. Find other product images with cdn.shopify.com
    $('img[src*="cdn.shopify.com"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('badge')) {
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          console.log(`✅ From img[src*="cdn.shopify.com"] - ${processed}`);
          images.push(processed);
        } else if (processed && images.includes(processed)) {
          console.log(`⏭️  Skipped duplicate from img[src] - ${processed}`);
        }
      }
    });

    // 3. Look for Shopify product gallery images
    $('.product__media img, .product-image img, .product-photo img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.includes('cdn.shopify.com')) {
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          console.log(`✅ From product gallery - ${processed}`);
          images.push(processed);
        } else if (processed && images.includes(processed)) {
          console.log(`⏭️  Skipped duplicate from gallery - ${processed}`);
        }
      }
    });

    // 4. Check for images in data attributes
    $('[data-src*="cdn.shopify.com"], [data-zoom*="cdn.shopify.com"]').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('data-zoom');
      if (src) {
        const processed = processShopifyImage(src);
        if (processed && !images.includes(processed)) {
          console.log(`✅ From data attributes - ${processed}`);
          images.push(processed);
        } else if (processed && images.includes(processed)) {
          console.log(`⏭️  Skipped duplicate from data attr - ${processed}`);
        }
      }
    });

    return images.slice(0, 10);
  }
}

async function test() {
  const parser = new TracingParser();
  const url = 'https://boutique.airelles.com/en/collections/fashion-accessories/products/dachshund-charm-bag-burgundy';

  console.log('🔍 Tracing Shopify image extraction...\n');

  const result = await parser.parse(url);

  console.log('\n📦 FINAL IMAGES:');
  result?.images?.forEach((img, i) => {
    console.log(`${i + 1}. ${img}`);
  });

  await parser.cleanup();
}

test().catch(console.error);
