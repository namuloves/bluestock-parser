const { scrapeAmazonProduct } = require('./amazon');
const { scrapeGarmentory } = require('./garmentory');
const { scrapeEbay } = require('./ebay');
const { scrapeRalphLauren } = require('./ralphlauren');
const { scrapeCOS } = require('./cos');
const { scrapeSezane } = require('./sezane');
const { scrapeNordstrom } = require('./nordstrom');
const { scrapeSsense } = require('./ssense');
const { scrapeSsenseSimple } = require('./ssense-simple');
const { detectCategory } = require('../utils/categoryDetection');

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
  if (hostname.includes('nordstrom.')) {
    return 'nordstrom';
  }
  if (hostname.includes('ssense.')) {
    return 'ssense';
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
        const garmentoryResult = await scrapeGarmentory(url);
        if (garmentoryResult.success && garmentoryResult.product) {
          const product = garmentoryResult.product;
          // Detect category using our intelligent detection
          const productName = product.product_name || product.name || '';
          console.log('🔍 Detecting category for:', productName);
          console.log('📝 Description:', product.description || 'No description');
          console.log('🏷️ Brand:', product.brand || 'No brand');
          
          const detectedCategory = detectCategory(
            productName,
            product.description || '',
            product.brand || '',
            product.category
          );
          console.log('✅ Detected category:', detectedCategory);
          
          // Add category to the product
          product.category = detectedCategory;
        }
        return garmentoryResult;
        
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
            category: detectCategory(
              ebayProduct.title || '',
              ebayProduct.description || '',
              ebayProduct.brand || 'Unknown Brand',
              ebayProduct.specifics?.Category
            ),
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
            category: detectCategory(
              rlProduct.name || '',
              rlProduct.description || '',
              'Ralph Lauren',
              rlProduct.category
            ),
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
            category: detectCategory(
              cosProduct.name || '',
              cosProduct.description || '',
              'COS',
              cosProduct.category
            ),
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
            category: detectCategory(
              sezaneProduct.name || '',
              sezaneProduct.description || '',
              'Sézane',
              sezaneProduct.category
            ),
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
        
      case 'nordstrom':
        console.log('🛍️ Using Nordstrom scraper');
        const nordstromProduct = await scrapeNordstrom(url);
        
        // Extract price number from string
        const nordstromPriceMatch = nordstromProduct.price?.match(/[\d,]+\.?\d*/);
        const nordstromPriceNumeric = nordstromPriceMatch ? parseFloat(nordstromPriceMatch[0].replace(',', '')) : 0;
        
        const nordstromOriginalPriceMatch = nordstromProduct.originalPrice?.match(/[\d,]+\.?\d*/);
        const nordstromOriginalPriceNumeric = nordstromOriginalPriceMatch ? parseFloat(nordstromOriginalPriceMatch[0].replace(',', '')) : nordstromPriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...nordstromProduct,
            
            // Database schema fields
            product_name: nordstromProduct.name,
            brand: nordstromProduct.brand || 'Nordstrom',
            original_price: nordstromOriginalPriceNumeric,
            sale_price: nordstromPriceNumeric,
            is_on_sale: nordstromProduct.isOnSale || false,
            discount_percentage: nordstromProduct.isOnSale ? Math.round((1 - nordstromPriceNumeric / nordstromOriginalPriceNumeric) * 100) : null,
            sale_badge: nordstromProduct.isOnSale ? 'SALE' : null,
            image_urls: nordstromProduct.images || [],
            vendor_url: nordstromProduct.url || url,
            color: nordstromProduct.color || '',
            category: detectCategory(
              nordstromProduct.name || '',
              nordstromProduct.description || '',
              nordstromProduct.brand || 'Nordstrom',
              nordstromProduct.category
            ),
            material: '',
            description: nordstromProduct.description || '',
            sizes: nordstromProduct.sizes || [],
            sku: nordstromProduct.sku || '',
            in_stock: nordstromProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: nordstromProduct.name,
            price: nordstromPriceNumeric,
            images: nordstromProduct.images || [],
            originalPrice: nordstromOriginalPriceNumeric,
            isOnSale: nordstromProduct.isOnSale || false,
            discountPercentage: nordstromProduct.isOnSale ? Math.round((1 - nordstromPriceNumeric / nordstromOriginalPriceNumeric) * 100) : null,
            saleBadge: nordstromProduct.isOnSale ? 'SALE' : null
          }
        };
        
      case 'ssense':
        console.log('🎨 Using SSENSE scraper');
        // Try simple scraper first (faster, works on Railway)
        let ssenseProduct;
        try {
          ssenseProduct = await scrapeSsenseSimple(url);
          console.log('✅ Simple SSENSE scraper succeeded');
          console.log('Product extracted:', ssenseProduct.name, 'Price:', ssenseProduct.price);
        } catch (error) {
          console.log('⚠️ Simple scraper failed:', error.message);
          console.log('Trying Puppeteer...');
          ssenseProduct = await scrapeSsense(url);
        }
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...ssenseProduct,
            
            // Database schema fields
            product_name: ssenseProduct.name,
            brand: ssenseProduct.brand || 'SSENSE',
            original_price: ssenseProduct.originalPrice || ssenseProduct.price,
            sale_price: ssenseProduct.price,
            is_on_sale: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price,
            discount_percentage: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price ? 
              Math.round((1 - ssenseProduct.price / ssenseProduct.originalPrice) * 100) : null,
            sale_badge: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price ? 'SALE' : null,
            image_urls: ssenseProduct.images || [],
            vendor_url: ssenseProduct.url || url,
            color: ssenseProduct.color || '',
            category: detectCategory(
              ssenseProduct.name || '',
              ssenseProduct.description || '',
              ssenseProduct.brand || 'SSENSE',
              ssenseProduct.category
            ),
            material: ssenseProduct.materials?.join(', ') || '',
            description: ssenseProduct.description || '',
            sizes: ssenseProduct.sizes || [],
            sku: ssenseProduct.productId || '',
            in_stock: ssenseProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: ssenseProduct.name,
            price: ssenseProduct.price,
            images: ssenseProduct.images || [],
            originalPrice: ssenseProduct.originalPrice || ssenseProduct.price,
            isOnSale: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price,
            discountPercentage: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price ? 
              Math.round((1 - ssenseProduct.price / ssenseProduct.originalPrice) * 100) : null,
            saleBadge: ssenseProduct.originalPrice && ssenseProduct.originalPrice > ssenseProduct.price ? 'SALE' : null
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