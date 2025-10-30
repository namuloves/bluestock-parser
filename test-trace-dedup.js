const cheerio = require('cheerio');

// Test the deduplication logic in isolation
const html = `
<meta property="og:image" content="http://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_1200x1200.jpg?v=1761232061">
<script type="application/ld+json">
{"@type":"Product","image":["https://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_4000x.jpg?v=1761232061"]}
</script>
`;

const $ = cheerio.load(html);
const imageBaseMap = new Map();

// Process OG image - remove crop parameters for higher resolution
const processShopifyImage = (url) => {
  if (!url) return null;

  // Accept both cdn.shopify.com and Shopify-hosted custom CDNs
  const isShopifyUrl = url.includes('cdn.shopify.com') ||
                      url.includes('/cdn/shop/') ||
                      url.includes('/cdn/shopifycloud/');

  if (!isShopifyUrl) return null;

  // Parse URL
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);

  // Remove size and crop parameters
  params.delete('width');
  params.delete('height');
  params.delete('crop');

  urlObj.search = params.toString();
  return urlObj.toString();
};

// Get the base image name without size suffixes
const getNormalizedImageBase = (url) => {
  if (!url) return null;

  try {
    // Handle protocol-relative URLs
    let normalizedUrl = url;
    if (url.startsWith('//')) {
      normalizedUrl = 'https:' + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Relative URL
      return null;
    }

    // Parse the URL to get the pathname
    const urlObj = new URL(normalizedUrl);
    let pathname = urlObj.pathname;

    // Remove Shopify size suffixes
    pathname = pathname.replace(/_\d+x\d*\./, '.');  // _1200x1200.jpg -> .jpg
    pathname = pathname.replace(/_\d+x\./, '.');      // _4000x.jpg -> .jpg
    pathname = pathname.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master)\./, '.');

    // Return normalized base (pathname + version param if exists)
    const vParam = urlObj.searchParams.get('v');
    return pathname + (vParam ? `?v=${vParam}` : '');
  } catch (e) {
    return null;
  }
};

// Choose the best quality URL
const chooseBestQuality = (url1, url2) => {
  const score = (url) => {
    if (!url) return 0;
    if (url.includes('_4000x')) return 100;
    if (url.includes('_original') || url.includes('_master')) return 90;
    if (url.includes('_2048x')) return 80;
    if (url.includes('_grande')) return 70;
    if (url.includes('_large')) return 60;
    if (url.includes('_1200x')) return 50;
    if (url.includes('_medium')) return 40;
    if (url.includes('_small')) return 20;
    // No size suffix = original
    if (!/_\d+x|_[a-z]+\./i.test(url)) return 95;
    return 30;
  };

  return score(url1) >= score(url2) ? url1 : url2;
};

// Helper to add image with deduplication
const addImageWithDedup = (url) => {
  console.log(`\n🔍 Processing: ${url}`);

  const processed = processShopifyImage(url);
  console.log(`   Processed: ${processed}`);
  if (!processed) return;

  const base = getNormalizedImageBase(processed);
  console.log(`   Normalized base: ${base}`);
  if (!base) return;

  // Check if we already have this image (different size variant)
  if (imageBaseMap.has(base)) {
    // Choose the better quality version
    const existing = imageBaseMap.get(base);
    console.log(`   ⚠️ Duplicate found!`);
    console.log(`      Existing: ${existing}`);
    const best = chooseBestQuality(existing, processed);
    console.log(`      Best quality: ${best}`);
    imageBaseMap.set(base, best);
  } else {
    // New unique image
    console.log(`   ✅ New unique image`);
    imageBaseMap.set(base, processed);
  }
};

// Test with both URLs
const ogImage = $('meta[property="og:image"]').attr('content');
console.log('OG Image:', ogImage);
addImageWithDedup(ogImage);

// Get JSON-LD image
$('script[type="application/ld+json"]').each((i, el) => {
  const content = $(el).html();
  try {
    const data = JSON.parse(content);
    if (data.image) {
      const images = Array.isArray(data.image) ? data.image : [data.image];
      images.forEach(img => {
        console.log('\nJSON-LD Image:', img);
        addImageWithDedup(img);
      });
    }
  } catch (e) {
    // Skip
  }
});

console.log('\n📦 FINAL RESULTS:');
console.log('Unique images:', imageBaseMap.size);
Array.from(imageBaseMap.values()).forEach((img, i) => {
  console.log(`${i + 1}. ${img}`);
});