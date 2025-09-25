const axios = require('axios');
const cheerio = require('cheerio');
const { getAxiosConfig } = require('../config/proxy');

const scrapeUnijay = async (url) => {
  console.log('🛍️ Starting Unijay scraper for:', url);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    const axiosConfig = getAxiosConfig(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });

    console.log('📡 Fetching Unijay page...');
    const response = await axios.get(url, axiosConfig);

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to fetch page`);
    }

    const $ = cheerio.load(response.data);

    // Extract product data
    const product = {
      url,
      name: '',
      price: '',
      originalPrice: '',
      description: '',
      images: [],
      brand: 'Unijay',
      sizes: [],
      colors: [],
      variants: [],
      inStock: true,
      currency: 'KRW',
      sku: '',
      vendor: 'Unijay'
    };

    // Extract product name
    product.name = $('.headingArea h2').text().trim() ||
                   $('meta[property="og:title"]').attr('content') ||
                   '';

    // Extract prices from JavaScript variables first (Cafe24 format)
    const scriptContent = response.data;
    let priceValue = '';
    let originalPriceValue = '';

    // Look for product_price variable in scripts
    const priceMatch = scriptContent.match(/var product_price = '(\d+)'/);
    if (priceMatch) {
      priceValue = priceMatch[1];
    }

    // Look for sale price or DC price
    const salePriceMatch = scriptContent.match(/var product_sale_price = '(\d+)'/) ||
                           scriptContent.match(/var mobile_dc_price = '(\d+)'/);
    if (salePriceMatch && salePriceMatch[1]) {
      originalPriceValue = priceValue;
      priceValue = salePriceMatch[1];
    }

    // Fallback to HTML price elements
    if (!priceValue) {
      const priceText = $('#span_product_price_text').text().trim() ||
                        $('.price').first().text().trim() ||
                        $('[class*="price"]:contains("원")').first().text().trim() ||
                        '';

      const salePriceText = $('#span_product_price_sale').text().trim() ||
                            $('.sale-price').first().text().trim() ||
                            '';

      // Parse prices (remove currency symbols and convert)
      if (salePriceText) {
        const saleMatch = salePriceText.match(/[\d,]+/);
        if (saleMatch) {
          priceValue = saleMatch[0].replace(/,/g, '');
        }
      }

      if (priceText && priceText !== salePriceText) {
        const priceMatch = priceText.match(/[\d,]+/);
        if (priceMatch) {
          const price = priceMatch[0].replace(/,/g, '');
          if (!priceValue) {
            priceValue = price;
          } else if (price !== priceValue) {
            originalPriceValue = price;
          }
        }
      }
    }

    // Set final prices
    if (priceValue) {
      product.price = priceValue;
    }
    if (originalPriceValue && originalPriceValue !== priceValue) {
      product.originalPrice = originalPriceValue;
    }

    // Extract description
    const descriptionArea = $('.cont').html() ||
                            $('.product-detail').html() ||
                            $('.xans-product-detail').html() ||
                            '';

    if (descriptionArea) {
      const $desc = cheerio.load(descriptionArea);
      $desc('script').remove();
      $desc('style').remove();
      product.description = $desc.text().trim().slice(0, 1000);
    }

    // Extract images
    const imageSet = new Set();

    // Main product images from Cafe24's image area
    $('.xans-product-image img, .keyImg img, .bigImage img').each((i, img) => {
      let imageUrl = $(img).attr('src') || $(img).attr('ec-data-src') || $(img).attr('data-src');
      if (imageUrl && !imageUrl.includes('icon_') && !imageUrl.includes('button_')) {
        if (!imageUrl.startsWith('http')) {
          imageUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : 'https://unijay.kr' + imageUrl;
        }
        imageSet.add(imageUrl);
      }
    });

    // Thumbnail images
    $('.xans-product-addimage img, .listImg img').each((i, img) => {
      let imageUrl = $(img).attr('src') || $(img).attr('ec-data-src') || $(img).attr('data-src');
      if (imageUrl && !imageUrl.includes('icon_') && !imageUrl.includes('button_')) {
        if (!imageUrl.startsWith('http')) {
          imageUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : 'https://unijay.kr' + imageUrl;
        }
        // Get larger version if it's a thumbnail
        imageUrl = imageUrl.replace('/tiny/', '/big/').replace('/small/', '/big/');
        imageSet.add(imageUrl);
      }
    });

    product.images = Array.from(imageSet);

    // Extract sizes and colors from options
    $('select[id*="product_option"] option, .xans-product-option select option').each((i, option) => {
      const optionText = $(option).text().trim();
      const optionValue = $(option).val();

      if (optionValue && optionValue !== '*' && optionValue !== '**') {
        // Check if it's a size option
        if (optionText.match(/\b(S|M|L|XL|XXL|XS|FREE|F)\b/i) ||
            optionText.match(/\d{2,3}/) ||
            optionText.includes('사이즈')) {
          const sizeMatch = optionText.match(/\b(XS|S|M|L|XL|XXL|FREE|F|\d{2,3})\b/i);
          if (sizeMatch && !product.sizes.includes(sizeMatch[0].toUpperCase())) {
            product.sizes.push(sizeMatch[0].toUpperCase());
          }
        }

        // Check if it's a color option
        if (optionText.includes('색상') || optionText.includes('컬러') || optionText.includes('color')) {
          const colorName = optionText.replace(/.*[-:]\s*/, '').trim();
          if (colorName && !product.colors.includes(colorName)) {
            product.colors.push(colorName);
          }
        }
      }
    });

    // Check stock status
    const soldOutText = $('.icon img[alt*="품절"], .soldout, .displaynone').length > 0 ||
                        $('body').text().includes('품절') ||
                        $('.xans-product-action .btnArea').text().includes('SOLD OUT');

    if (soldOutText) {
      product.inStock = false;
    }

    // Extract SKU/Product Code
    product.sku = $('.xans-product-detail li:contains("상품코드")').text().replace('상품코드', '').replace(':', '').trim() ||
                  $('.xans-product-detail li:contains("Product Code")').text().replace('Product Code', '').replace(':', '').trim() ||
                  '';

    console.log('✅ Successfully scraped Unijay product:', product.name);

    return product;

  } catch (error) {
    console.error('❌ Error scraping Unijay:', error.message);

    return {
      url,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { scrapeUnijay };