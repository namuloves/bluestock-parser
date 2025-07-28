const { scrapeAmazonProduct } = require('./amazon');
const { scrapeGarmentory } = require('./garmentory');
const { scrapeEbay } = require('./ebay');
const { scrapeRalphLauren } = require('./ralphlauren');
const { scrapeCOS } = require('./cos');
const { scrapeSezane } = require('./sezane');

// Site detection function
const detectSite = (url) => {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('amazon.')) {
    return 'amazon';
  }
  if (hostname.includes('farfetch.')) {
    return 'farfetch';
  }
  if (hostname.includes('etsy.')) {
    return 'etsy';
  }
  if (hostname.includes('garmentory.')) {
    return 'garmentory';
  }
  if (hostname.includes('ebay.')) {
    return 'ebay';
  }
  if (hostname.includes('ralphlauren.')) {
    return 'ralphlauren';
  }
  if (hostname.includes('cos.')) {
    return 'cos';
  }
  if (hostname.includes('sezane.')) {
    return 'sezane';
  }
  
  return 'generic';
};

// Main scraping function with site routing
const scrapeProduct = async (url) => {
  console.log('🔍 Detecting site for:', url);
  
  const site = detectSite(url);
  console.log('🏷️ Detected site:', site);
  
  try {
    switch (site) {
      case 'amazon':
        console.log('🛒 Using Amazon scraper');
        return await scrapeAmazonProduct(url);
        
      case 'garmentory':
        console.log('👗 Using Garmentory scraper');
        return await scrapeGarmentory(url);
        
      case 'ebay':
        console.log('🛍️ Using eBay scraper');
        const ebayProduct = await scrapeEbay(url);
        return {
          success: true,
          product: {
            // Keep all original fields
            ...ebayProduct,
            
            // Database schema fields
            product_name: ebayProduct.title,
            brand: ebayProduct.brand || 'Unknown Brand',
            original_price: ebayProduct.originalPrice ? ebayProduct.priceNumeric : ebayProduct.priceNumeric,
            sale_price: ebayProduct.priceNumeric || 0,
            is_on_sale: ebayProduct.onSale || false,
            discount_percentage: ebayProduct.discount || null,
            sale_badge: ebayProduct.onSale ? `${ebayProduct.discount}% OFF` : null,
            image_urls: ebayProduct.images || [],
            vendor_url: ebayProduct.url,
            color: ebayProduct.specifics?.Color || '',
            category: ebayProduct.specifics?.Category || '',
            material: ebayProduct.specifics?.Material || '',
            
            // Legacy fields for backward compatibility
            name: ebayProduct.title,
            price: ebayProduct.priceNumeric || 0,
            images: ebayProduct.images || [],
            originalPrice: ebayProduct.originalPrice ? ebayProduct.priceNumeric : ebayProduct.priceNumeric,
            isOnSale: ebayProduct.onSale || false,
            discountPercentage: ebayProduct.discount || null,
            saleBadge: ebayProduct.onSale ? `${ebayProduct.discount}% OFF` : null
          }
        };
        
      case 'ralphlauren':
        console.log('👔 Using Ralph Lauren HTML scraper');
        const rlProduct = await scrapeRalphLauren(url);
        
        // Extract price number from string (e.g., "$395" -> 395)
        const priceMatch = rlProduct.price?.match(/[\d,]+\.?\d*/);
        const priceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        
        const originalPriceMatch = rlProduct.originalPrice?.match(/[\d,]+\.?\d*/);
        const originalPriceNumeric = originalPriceMatch ? parseFloat(originalPriceMatch[0].replace(',', '')) : priceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...rlProduct,
            
            // Database schema fields
            product_name: rlProduct.name,
            brand: rlProduct.brand || 'Ralph Lauren',
            original_price: originalPriceNumeric,
            sale_price: priceNumeric,
            is_on_sale: rlProduct.isOnSale || false,
            discount_percentage: rlProduct.isOnSale ? Math.round((1 - priceNumeric / originalPriceNumeric) * 100) : null,
            sale_badge: rlProduct.isOnSale ? 'SALE' : null,
            image_urls: rlProduct.images || [],
            vendor_url: rlProduct.url || url,
            color: rlProduct.color || '',
            category: rlProduct.category || 'Apparel',
            material: '',
            description: rlProduct.description || '',
            sizes: rlProduct.sizes || [],
            sku: rlProduct.sku || '',
            in_stock: rlProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: rlProduct.name,
            price: priceNumeric,
            images: rlProduct.images || [],
            originalPrice: originalPriceNumeric,
            isOnSale: rlProduct.isOnSale || false,
            discountPercentage: rlProduct.isOnSale ? Math.round((1 - priceNumeric / originalPriceNumeric) * 100) : null,
            saleBadge: rlProduct.isOnSale ? 'SALE' : null
          }
        };
        
      case 'cos':
        console.log('🛍️ Using COS HTML scraper');
        const cosProduct = await scrapeCOS(url);
        
        // Extract price number from string (e.g., "$59" -> 59)
        const cosPriceMatch = cosProduct.price?.match(/[\d,]+\.?\d*/);
        const cosPriceNumeric = cosPriceMatch ? parseFloat(cosPriceMatch[0].replace(',', '')) : 0;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...cosProduct,
            
            // Database schema fields
            product_name: cosProduct.name,
            brand: cosProduct.brand || 'COS',
            original_price: cosProduct.originalPrice ? parseFloat(cosProduct.originalPrice.replace(/[^0-9.]/g, '')) : cosPriceNumeric,
            sale_price: cosPriceNumeric,
            is_on_sale: cosProduct.isOnSale || false,
            discount_percentage: null,
            sale_badge: cosProduct.isOnSale ? 'SALE' : null,
            image_urls: cosProduct.images || [],
            vendor_url: cosProduct.url || url,
            color: cosProduct.color || '',
            category: cosProduct.category || 'Fashion',
            material: '',
            description: cosProduct.description || '',
            sizes: cosProduct.sizes || [],
            sku: cosProduct.sku || '',
            in_stock: cosProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: cosProduct.name,
            price: cosPriceNumeric,
            images: cosProduct.images || [],
            originalPrice: cosPriceNumeric,
            isOnSale: cosProduct.isOnSale || false,
            discountPercentage: null,
            saleBadge: cosProduct.isOnSale ? 'SALE' : null
          }
        };
        
      case 'sezane':
        console.log('🇫🇷 Using Sezane scraper');
        const sezaneProduct = await scrapeSezane(url);
        
        // Extract price number from string
        const sezanePriceMatch = sezaneProduct.price?.match(/[\d,]+\.?\d*/);
        const sezanePriceNumeric = sezanePriceMatch ? parseFloat(sezanePriceMatch[0].replace(',', '')) : 0;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...sezaneProduct,
            
            // Database schema fields
            product_name: sezaneProduct.name,
            brand: sezaneProduct.brand || 'Sézane',
            original_price: sezanePriceNumeric,
            sale_price: sezanePriceNumeric,
            is_on_sale: sezaneProduct.isOnSale || false,
            discount_percentage: null,
            sale_badge: null,
            image_urls: sezaneProduct.images || [],
            vendor_url: sezaneProduct.url || url,
            color: sezaneProduct.color || '',
            category: sezaneProduct.category || 'Fashion',
            material: '',
            description: sezaneProduct.description || '',
            sizes: sezaneProduct.sizes || [],
            sku: sezaneProduct.sku || '',
            in_stock: sezaneProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: sezaneProduct.name,
            price: sezanePriceNumeric,
            images: sezaneProduct.images || [],
            originalPrice: sezanePriceNumeric,
            isOnSale: sezaneProduct.isOnSale || false,
            discountPercentage: null,
            saleBadge: null
          }
        };
        
      case 'farfetch':
        console.log('👗 Farfetch scraper not implemented yet');
        return {
          success: false,
          error: 'Farfetch scraper coming soon'
        };
        
      case 'etsy':
        console.log('🎨 Etsy scraper not implemented yet');
        return {
          success: false,
          error: 'Etsy scraper coming soon'
        };
        
      default:
        console.log('🔧 Using generic scraper (mock data)');
        return {
          success: true,
          product: {
            product_name: "Sample Product",
            brand: "Sample Brand",
            original_price: 99.99,
            sale_price: 79.99,
            is_on_sale: true,
            discount_percentage: 20,
            sale_badge: "20% OFF",
            image_urls: ["https://example.com/image1.jpg"],
            description: "Product description will be scraped here",
            color: "Black",
            category: "Electronics",
            material: "Plastic",
            // Consistent naming for main app
            name: "Sample Product",
            images: ["https://example.com/image1.jpg"],
            price: 79.99,
            originalPrice: 99.99,
            isOnSale: true,
            saleBadge: "20% OFF"
          }
        };
    }
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    return {
      success: false,
      error: `Scraping failed: ${error.message}`
    };
  }
};

module.exports = {
  scrapeProduct,
  detectSite
};