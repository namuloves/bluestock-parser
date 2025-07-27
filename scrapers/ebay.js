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

    // Extract brand name - look in item specifics
    let brand = '';
    $('.ux-labels-values').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels span').first().text().trim();
      if (label === 'Brand') {
        brand = $(el).find('.ux-labels-values__values span').first().text().trim();
      }
    });
    product.brand = brand || $('span[itemprop="brand"]').text().trim();

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

    // Extract images - use Set to avoid duplicates
    const imageSet = new Set();
    
    // Try different image selectors
    $('div.ux-image-carousel-item img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('s-l64')) {
        // Convert to high resolution
        const highResSrc = src.replace(/s-l\d+/, 's-l1600');
        imageSet.add(highResSrc);
      }
    });

    // Alternative image selector
    if (imageSet.size === 0) {
      $('img.img-magnify').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) {
          imageSet.add(src);
        }
      });
    }

    // Get main image if no carousel images found
    if (imageSet.size === 0) {
      const mainImg = $('div.ux-image-carousel img').first().attr('src') ||
                     $('img#icImg').attr('src');
      if (mainImg) {
        imageSet.add(mainImg);
      }
    }
    
    product.images = Array.from(imageSet);

    // Extract item condition
    let condition = '';
    $('.ux-labels-values').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels span').first().text().trim();
      if (label === 'Condition') {
        // Get just the first text to avoid "Read more" text
        const valueEl = $(el).find('.ux-labels-values__values span').first();
        condition = valueEl.contents().filter(function() {
          return this.nodeType === 3; // Text node only
        }).first().text().trim();
      }
    });
    product.condition = condition || $('div.u-flL.condText').text().trim();

    // Extract seller information
    let sellerName = '';
    $('.ux-labels-values').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels span').first().text().trim();
      if (label === 'Seller:') {
        sellerName = $(el).find('.ux-labels-values__values span a').text().trim() || 
                    $(el).find('.ux-labels-values__values span').first().text().trim();
      }
    });
    
    product.seller = {
      name: sellerName || $('a.mbg-id').text().trim(),
      feedback: $('span.mbg-l').text().trim()
    };

    // Extract shipping information
    let shipping = '';
    $('.ux-labels-values').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels span').first().text().trim();
      if (label === 'Shipping:') {
        shipping = $(el).find('.ux-labels-values__values span').first().text().trim();
      }
    });
    product.shipping = shipping || $('span.vi-acc-del-range').text().trim();

    // Extract item specifics - improved to handle the nested structure properly
    product.specifics = {};
    $('.ux-labels-values').each((i, el) => {
      const label = $(el).find('.ux-labels-values__labels span').first().text().trim();
      const value = $(el).find('.ux-labels-values__values span').first().text().trim();
      
      // Skip empty labels (like payment info sections)
      if (label && value && 
          !label.includes('Shipping') && 
          !label.includes('Delivery') && 
          !label.includes('Returns') && 
          !label.includes('Payments') &&
          label !== 'Condition' && // Already handled separately
          label !== 'Brand' && // Already handled separately  
          label !== 'Seller:') { // Already handled separately
        product.specifics[label] = value;
      }
    });

    // Alternative specifics selector if nothing found
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

    // Try to extract description from iframe
    const iframeSrc = $('#desc_ifr').attr('src');
    if (iframeSrc) {
      try {
        console.log('Fetching eBay description from iframe:', iframeSrc);
        const descResponse = await axios.get(iframeSrc, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
          },
          timeout: 5000
        });
        
        const desc$ = cheerio.load(descResponse.data);
        
        // Remove scripts and styles
        desc$('script').remove();
        desc$('style').remove();
        
        // Get text content from body
        const descriptionText = desc$('body').text().trim();
        
        // Check if this is a real description or just template/instructions
        const isTemplateText = descriptionText.toLowerCase().includes("click the 'see full description'") ||
                              descriptionText.toLowerCase().includes("see full description link below") ||
                              descriptionText.length < 20 ||
                              descriptionText.toLowerCase().includes("no description available");
        
        if (descriptionText && descriptionText.length > 10 && !isTemplateText) {
          // Clean up common template artifacts
          let cleanedDescription = descriptionText
            .replace(/\s+/g, ' ')
            .replace(/×.*?Buy now and save!.*$/i, '') // Remove template footer
            .replace(/Tell a friend.*$/i, '')
            .replace(/Visit store.*$/i, '')
            .replace(/Watch now.*$/i, '')
            .replace(/You might also like.*$/i, '')
            .replace(/Contact To contact.*$/i, '')
            .replace(/Postage Shipping.*$/i, '')
            .replace(/Payment Accepted.*$/i, '')
            .replace(/Returns Returns.*$/i, '')
            .replace(/Additional Information.*$/i, '')
            .replace(/eBay integration by.*$/i, '')
            .trim();
          
          // Only use if there's meaningful content left
          if (cleanedDescription.length > 30) {
            product.description = cleanedDescription;
            console.log('Found seller description:', product.description.substring(0, 100) + '...');
          }
        }
      } catch (error) {
        console.log('Could not fetch description from iframe:', error.message);
      }
    }

    // AI Description Structure - only if no seller description exists
    if (!product.description) {
      product.aiContext = {
        needsDescription: true,
        productInfo: {
          title: product.title,
          brand: product.brand,
          condition: product.condition,
          specifics: product.specifics,
          price: product.price,
          images: product.images.slice(0, 3) // First 3 images for AI context
        },
        description: null
      };
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

// Function to enhance product with AI description
async function enhanceWithAI(product, aiService) {
  if (!product.aiContext || !product.aiContext.needsDescription) {
    return product;
  }

  if (!aiService) {
    console.log('No AI service provided, returning product without AI description');
    return product;
  }

  try {
    return await aiService.enhanceProductWithDescription(product);
  } catch (error) {
    console.error('AI enhancement error:', error);
    return product;
  }
}

module.exports = { scrapeEbay, enhanceWithAI };