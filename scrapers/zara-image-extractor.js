/**
 * Zara Post-Processor
 * Extracts main product images and price from Firecrawl HTML
 */

const cheerio = require('cheerio');

/**
 * Extract all main product images from Zara HTML
 * @param {string} html - Raw HTML from Firecrawl
 * @param {string} productId - Zara product ID (e.g., "15205610")
 * @returns {Array<string>} - Array of main product image URLs
 */
function extractZaraImages(html, productId) {
  if (!html || !productId) {
    console.log('⚠️ Missing HTML or product ID for Zara image extraction');
    return [];
  }

  console.log(`🔍 Extracting Zara images for product: ${productId}`);

  // Extract all Zara CDN image URLs from HTML
  const imagePattern = /https:\/\/static\.zara\.net[^"'\s,]+(jpg|jpeg|png|webp)(\?[^"'\s]*)?/gi;
  const allImages = [...new Set(html.match(imagePattern) || [])];

  console.log(`  📊 Found ${allImages.length} total Zara images in HTML`);

  // Filter for main product images only
  // Main images have the product ID and specific suffixes: -p (primary), -a1 (angle), -e1 to -e4 (extra)
  const mainImages = allImages.filter(img => {
    const isMainImage = (
      img.includes(productId) && // Contains product ID
      !img.includes('thumb') &&
      !img.includes('icon') &&
      !img.includes('badge') &&
      !img.includes('logo') &&
      (img.includes('-p/') || img.includes('-a') || img.includes('-e')) // Product/angle/extra views
    );
    return isMainImage;
  });

  console.log(`  ✅ Filtered to ${mainImages.length} main product images`);

  // Remove duplicates (same image with different query params)
  const uniqueMainImages = [];
  const seenBaseUrls = new Set();

  for (const img of mainImages) {
    const baseUrl = img.split('?')[0];
    if (!seenBaseUrls.has(baseUrl)) {
      seenBaseUrls.add(baseUrl);
      uniqueMainImages.push(img);
    }
  }

  console.log(`  📸 Final count: ${uniqueMainImages.length} unique main images`);

  // Log first few for debugging
  if (uniqueMainImages.length > 0) {
    console.log('  First 3 images:');
    uniqueMainImages.slice(0, 3).forEach((img, i) => {
      const typeMatch = img.match(/-([pae]\d*)\//);
      const imageType = typeMatch ? typeMatch[1] : 'unknown';
      console.log(`    ${i + 1}. [${imageType}] ${img.substring(0, 80)}...`);
    });
  }

  return uniqueMainImages;
}

/**
 * Extract product ID from Zara URL
 * @param {string} url - Zara product URL
 * @returns {string|null} - Product ID or null
 */
function extractZaraProductId(url) {
  // Zara URLs: https://www.zara.com/us/en/product-name-p15205610.html
  const match = url.match(/-p(\d+)\.html/);
  return match ? match[1] : null;
}

/**
 * Extract price from Zara HTML
 * @param {string} html - Raw HTML from Firecrawl
 * @returns {number|null} - Price as number or null
 */
function extractZaraPrice(html) {
  if (!html) {
    console.log('⚠️ Missing HTML for Zara price extraction');
    return null;
  }

  console.log('💰 Extracting Zara price...');

  try {
    const $ = cheerio.load(html);

    // Try the specific product detail price selector first
    const productPrice = $('.product-detail-info__price .money-amount__main').first().text().trim();
    if (productPrice) {
      // Extract numeric value from price string like "$ 55.90"
      const priceMatch = productPrice.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[0].replace(/,/g, ''));
        console.log(`  ✅ Found price: $${price}`);
        return price;
      }
    }

    // Fallback: try general money-amount__main selector
    const generalPrice = $('.money-amount__main').first().text().trim();
    if (generalPrice) {
      const priceMatch = generalPrice.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[0].replace(/,/g, ''));
        console.log(`  ✅ Found price (fallback): $${price}`);
        return price;
      }
    }

    console.log('  ⚠️ Could not find price in HTML');
    return null;
  } catch (error) {
    console.log(`  ❌ Error extracting price: ${error.message}`);
    return null;
  }
}

module.exports = {
  extractZaraImages,
  extractZaraProductId,
  extractZaraPrice
};