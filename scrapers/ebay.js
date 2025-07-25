const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeEbay(url) {
  try {
    // Extract item ID from URL
    const itemIdMatch = url.match(/itm\/(\d+)/);
    if (!itemIdMatch) {
      throw new Error('Invalid eBay URL - could not extract item ID');
    }
    const itemId = itemIdMatch[1];

    // Clean URL to avoid tracking parameters
    const cleanUrl = `https://www.ebay.com/itm/${itemId}`;
    
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract product information
    const product = {
      url: cleanUrl,
      itemId: itemId,
      platform: 'ebay'
    };

    // Extract item name
    product.title = $('h1.x-item-title__mainTitle span').text().trim() || 
                   $('h1.it-ttl').text().trim() ||
                   $('[data-testid="x-item-title"]').text().trim();

    // Extract brand name
    product.brand = $('span[itemprop="brand"]').text().trim() ||
                   $('.u-flL.iti-act-num').text().trim() ||
                   $('div.u-flL h2 span[itemprop="brand"]').text().trim();

    // Extract price
    const priceText = $('div.x-price-primary span.ux-textspans').first().text().trim() ||
                     $('.x-price-whole').text().trim() ||
                     $('span.notranslate').first().text().trim() ||
                     $('[data-testid="x-price-primary"]').text().trim();
    
    product.price = priceText;
    
    // Extract numeric price for calculations
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    if (priceMatch) {
      product.priceNumeric = parseFloat(priceMatch[0].replace(/,/g, ''));
    }

    // Extract images
    product.images = [];
    
    // Try different image selectors
    $('div.ux-image-carousel-item img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('s-l64')) {
        // Convert to high resolution
        const highResSrc = src.replace(/s-l\d+/, 's-l1600');
        product.images.push(highResSrc);
      }
    });

    // Alternative image selector
    if (product.images.length === 0) {
      $('img.img-magnify').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) {
          product.images.push(src);
        }
      });
    }

    // Get main image if no carousel images found
    if (product.images.length === 0) {
      const mainImg = $('div.ux-image-carousel img').first().attr('src') ||
                     $('img#icImg').attr('src');
      if (mainImg) {
        product.images.push(mainImg);
      }
    }

    // Extract item condition
    product.condition = $('div.u-flL.condText').text().trim() ||
                       $('span.ux-textspans--SECONDARY').text().trim() ||
                       $('.u-flL.condText').text().trim();

    // Extract item description
    const descriptionFrame = $('iframe#desc_ifr');
    if (descriptionFrame.length > 0) {
      // Description is in iframe, we'll note this
      product.description = 'Full description available on eBay page';
    } else {
      product.description = $('div.ux-layout-section__item--description').text().trim() ||
                           $('.section-desc').text().trim() ||
                           'See full description on eBay';
    }

    // Extract seller information
    product.seller = {
      name: $('span.ux-textspans--BOLD').filter(':contains("Seller:")').next().text().trim() ||
            $('a.mbg-id').text().trim(),
      feedback: $('span.mbg-l').text().trim()
    };

    // Extract shipping information
    product.shipping = $('span.vi-acc-del-range').text().trim() ||
                      $('.ux-labels-values__values-content span').filter(':contains("shipping")').text().trim();

    // Extract item specifics
    product.specifics = {};
    $('div.ux-layout-section-evo__item').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels-content span').text().trim();
      const value = $(el).find('.ux-labels-values__values-content span').text().trim();
      if (label && value) {
        product.specifics[label] = value;
      }
    });

    // Alternative specifics selector
    if (Object.keys(product.specifics).length === 0) {
      $('.viSNotesCnt table tr').each((i, el) => {
        const label = $(el).find('td.attrLabels').text().replace(':', '').trim();
        const value = $(el).find('td:not(.attrLabels)').text().trim();
        if (label && value) {
          product.specifics[label] = value;
        }
      });
    }

    // Extract availability
    product.availability = $('span.qtyTxt').text().trim() ||
                          $('.ux-quantity__availability').text().trim();

    // Check if item is on sale
    const originalPrice = $('span.ux-textspans--STRIKETHROUGH').text().trim();
    if (originalPrice) {
      product.originalPrice = originalPrice;
      product.onSale = true;
      
      const originalMatch = originalPrice.match(/[\d,]+\.?\d*/);
      if (originalMatch && product.priceNumeric) {
        const originalNumeric = parseFloat(originalMatch[0].replace(/,/g, ''));
        product.discount = Math.round((1 - product.priceNumeric / originalNumeric) * 100);
      }
    } else {
      product.onSale = false;
    }

    // Clean up empty fields
    Object.keys(product).forEach(key => {
      if (product[key] === '' || product[key] === null || product[key] === undefined) {
        delete product[key];
      }
    });

    return product;
  } catch (error) {
    console.error('eBay scraping error:', error.message);
    throw error;
  }
}

module.exports = { scrapeEbay };