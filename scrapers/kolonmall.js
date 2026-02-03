const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scraper for kolonmall.com
 * - Pulls full-resolution LZ images (1500px) instead of low-res LS thumbnails
 * - Extracts prices from embedded JSON (price, wishPrice, currencyIso)
 */
async function scrapeKolonmall(url) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'accept-language': 'en-US,en;q=0.8,ko;q=0.6'
  };

  const response = await axios.get(url, { headers });
  const html = response.data;
  const $ = cheerio.load(html);

  // Try to infer the product code from the URL to keep images scoped
  const productCodeMatch = url.match(/\/Product\/([^/?#]+)/i);
  const productCode = productCodeMatch ? productCodeMatch[1] : null;

  // Collect image URLs from HTML and upgrade them to LZ (hi-res) variants
  const imageRegex = /https?:\/\/images\.kolonmall\.com\/Prod_Img\/[^"\s')]+/g;
  const images = new Set();

  let match;
  while ((match = imageRegex.exec(html)) !== null) {
    let imgUrl = match[0].replace(/\\+$/, ''); // remove trailing escapes

    if (productCode && !imgUrl.includes(productCode)) {
      continue; // Skip unrelated assets
    }

    // Prefer LZ variants (largest); convert LS/LM to LZ while keeping the index
    imgUrl = imgUrl
      .replace(/\/L[SM](\d+)\//, (_m, idx) => `/LZ${idx}/`)
      .replace(/_L[SM](\d+)\.jpg/i, (_m, idx) => `_LZ${idx}.jpg`);

    images.add(imgUrl);
  }

  const imageList = Array.from(images);

  // Extract price block from embedded JSON
  let priceObj = null;
  const priceMatch = html.match(/price":\s*\{[^}]*?\}/);
  if (priceMatch) {
    const jsonStr = priceMatch[0].replace(/^price":\s*/, '');
    try {
      priceObj = JSON.parse(jsonStr);
    } catch (e) {
      // Ignore parse errors and fall back to defaults
    }
  }

  const salePrice = priceObj?.price || null;
  const originalPrice = priceObj?.wishPrice || salePrice || null;
  const currency = priceObj?.currencyIso || 'KRW';
  const currencySource = currency ? 'parser' : 'unknown';
  const discountPercentage = priceObj?.discountRate ?? (
    originalPrice && salePrice && originalPrice > salePrice
      ? Math.round((1 - salePrice / originalPrice) * 100)
      : null
  );

  const name = $('meta[property="og:title"]').attr('content') ||
               $('h1').first().text().trim() ||
               '';
  const description = $('meta[name="description"]').attr('content') ||
                      $('meta[property="og:description"]').attr('content') ||
                      '';

  return {
    success: true,
    product: {
      product_name: name,
      brand: 'Kolon Mall',
      sale_price: salePrice || 0,
      original_price: originalPrice || salePrice || 0,
      is_on_sale: originalPrice ? originalPrice > (salePrice || 0) : false,
      discount_percentage: discountPercentage,
      currency,
      currency_source: currencySource,
      currency_detection_source: currencySource,
      price_text: priceObj?.formattedPrice || '',
      image_urls: imageList,
      description,
      vendor_url: url,
      platform: 'kolonmall',

      // Legacy fields
      name,
      price: salePrice || 0,
      images: imageList
    }
  };
}

module.exports = { scrapeKolonmall };
