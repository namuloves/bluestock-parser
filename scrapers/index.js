const { scrapeAmazonProduct } = require('./amazon');
const { scrapeGarmentory } = require('./garmentory');
const { scrapeEbay } = require('./ebay');
const { scrapeRalphLauren } = require('./ralphlauren');
const { scrapeCOS } = require('./cos');
const { scrapeSezane } = require('./sezane');
const { scrapeNordstrom } = require('./nordstrom');
const { scrapeSsense } = require('./ssense');
const { scrapeSsenseSimple } = require('./ssense-simple');
const { scrapeSsenseFallback } = require('./ssense-fallback');
const { scrapeSaksFifthAvenue } = require('./saksfifthavenue');
const { scrapeEtsy } = require('./etsy');
const { scrapePoshmark } = require('./poshmark');
const { scrapeShopify, isShopifyStore } = require('./shopify');
const { scrapeShopStyle } = require('./shopstyle');
const { handleRedirect } = require('./redirect-handler');
const { scrapeInstagram } = require('./instagram');
const { scrapeZara } = require('./zara');
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
  if (hostname.includes('saksfifthavenue.') || hostname.includes('saks.')) {
    return 'saksfifthavenue';
  }
  if (hostname.includes('poshmark.')) {
    return 'poshmark';
  }
  if (hostname.includes('shopstyle.')) {
    return 'shopstyle';
  }
  if (hostname.includes('go.shopmy.us') || hostname.includes('shopmy.us')) {
    return 'redirect';
  }
  if (hostname.includes('bit.ly')) {
    return 'redirect';
  }
  if (hostname.includes('shareasale.com')) {
    return 'redirect';
  }
  if (hostname.includes('click.linksynergy.com')) {
    return 'redirect';
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  if (hostname.includes('zara.com')) {
    return 'zara';
  }
  
  // Check for known Shopify domains
  const shopifyDomains = [
    'chavastudio.com',
    'phoebephilo.com',
    'stoffa.co',
    'soeur.fr',
    'shopattersee.com',
    'babaa.es',
    'nu-swim.com',
    'shopneighbour.com',
    'shop-vestige.com',
    'rachelcomey.com',
    'oldstonetrade.com',
    'flore-flore.com',
    'emreitz.com',
    'tibi.com',
    'fm669.us',
    'jamesstreetco.com',
    'gimaguas.com'
  ];
  
  for (const domain of shopifyDomains) {
    if (hostname.includes(domain)) {
      return 'shopify';
    }
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
              rlProduct.brand || 'Ralph Lauren',
              rlProduct.category
            ),
            material: rlProduct.materials?.join(', ') || '',
            
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
        console.log('🎨 Using COS scraper');
        const cosProduct = await scrapeCOS(url);
        
        // Process price (should already be numeric from scraper)
        const cosPriceNumeric = typeof cosProduct.price === 'number' ? cosProduct.price : 0;
        const cosOriginalPriceNumeric = cosProduct.originalPrice || cosPriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...cosProduct,
            
            // Database schema fields
            product_name: cosProduct.name,
            brand: cosProduct.brand || 'COS',
            original_price: cosOriginalPriceNumeric,
            sale_price: cosPriceNumeric,
            is_on_sale: cosProduct.isOnSale || false,
            discount_percentage: cosProduct.isOnSale && cosOriginalPriceNumeric > cosPriceNumeric ? 
              Math.round((1 - cosPriceNumeric / cosOriginalPriceNumeric) * 100) : null,
            sale_badge: cosProduct.isOnSale ? 'SALE' : null,
            image_urls: cosProduct.images || [],
            vendor_url: cosProduct.url || url,
            color: cosProduct.color || '',
            category: detectCategory(
              cosProduct.name || '',
              cosProduct.description || '',
              cosProduct.brand || 'COS',
              cosProduct.category
            ),
            material: cosProduct.materials?.join(', ') || '',
            
            // Legacy fields for backward compatibility
            name: cosProduct.name,
            price: cosPriceNumeric,
            images: cosProduct.images || [],
            originalPrice: cosOriginalPriceNumeric,
            isOnSale: cosProduct.isOnSale || false,
            discountPercentage: cosProduct.isOnSale && cosOriginalPriceNumeric > cosPriceNumeric ? 
              Math.round((1 - cosPriceNumeric / cosOriginalPriceNumeric) * 100) : null,
            saleBadge: cosProduct.isOnSale ? 'SALE' : null
          }
        };
        
      case 'sezane':
        console.log('🇫🇷 Using Sezane scraper');
        const sezaneProduct = await scrapeSezane(url);
        
        // Process price
        const sezanePriceNumeric = typeof sezaneProduct.price === 'number' ? sezaneProduct.price : 0;
        const sezaneOriginalPriceNumeric = sezaneProduct.originalPrice || sezanePriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...sezaneProduct,
            
            // Database schema fields
            product_name: sezaneProduct.name,
            brand: sezaneProduct.brand || 'Sezane',
            original_price: sezaneOriginalPriceNumeric,
            sale_price: sezanePriceNumeric,
            is_on_sale: sezaneProduct.isOnSale || false,
            discount_percentage: sezaneProduct.isOnSale && sezaneOriginalPriceNumeric > sezanePriceNumeric ? 
              Math.round((1 - sezanePriceNumeric / sezaneOriginalPriceNumeric) * 100) : null,
            sale_badge: sezaneProduct.isOnSale ? 'SALE' : null,
            image_urls: sezaneProduct.images || [],
            vendor_url: sezaneProduct.url || url,
            color: sezaneProduct.color || '',
            category: detectCategory(
              sezaneProduct.name || '',
              sezaneProduct.description || '',
              sezaneProduct.brand || 'Sezane',
              sezaneProduct.category
            ),
            material: sezaneProduct.materials?.join(', ') || '',
            
            // Legacy fields for backward compatibility
            name: sezaneProduct.name,
            price: sezanePriceNumeric,
            images: sezaneProduct.images || [],
            originalPrice: sezaneOriginalPriceNumeric,
            isOnSale: sezaneProduct.isOnSale || false,
            discountPercentage: sezaneProduct.isOnSale && sezaneOriginalPriceNumeric > sezanePriceNumeric ? 
              Math.round((1 - sezanePriceNumeric / sezaneOriginalPriceNumeric) * 100) : null,
            saleBadge: sezaneProduct.isOnSale ? 'SALE' : null
          }
        };
        
      case 'nordstrom':
        console.log('🛍️ Using Nordstrom scraper');
        const nordstromProduct = await scrapeNordstrom(url);
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...nordstromProduct,
            
            // Database schema fields
            product_name: nordstromProduct.name,
            brand: nordstromProduct.brand || 'Nordstrom',
            original_price: nordstromProduct.originalPrice || nordstromProduct.price,
            sale_price: nordstromProduct.price,
            is_on_sale: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price,
            discount_percentage: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price ? 
              Math.round((1 - nordstromProduct.price / nordstromProduct.originalPrice) * 100) : null,
            sale_badge: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price ? 'SALE' : null,
            image_urls: nordstromProduct.images || [],
            vendor_url: nordstromProduct.url || url,
            color: nordstromProduct.color || '',
            category: detectCategory(
              nordstromProduct.name || '',
              nordstromProduct.description || '',
              nordstromProduct.brand || 'Nordstrom',
              nordstromProduct.category
            ),
            material: nordstromProduct.materials?.join(', ') || '',
            description: nordstromProduct.description || '',
            sizes: nordstromProduct.sizes || [],
            sku: nordstromProduct.productId || '',
            in_stock: nordstromProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: nordstromProduct.name,
            price: nordstromProduct.price,
            images: nordstromProduct.images || [],
            originalPrice: nordstromProduct.originalPrice || nordstromProduct.price,
            isOnSale: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price,
            discountPercentage: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price ? 
              Math.round((1 - nordstromProduct.price / nordstromProduct.originalPrice) * 100) : null,
            saleBadge: nordstromProduct.originalPrice && nordstromProduct.originalPrice > nordstromProduct.price ? 'SALE' : null
          }
        };
        
      case 'ssense':
        console.log('🎨 Using SSENSE scraper');
        let ssenseProduct;
        
        // Try simple scraper with proxy
        try {
          ssenseProduct = await scrapeSsenseSimple(url);
          console.log('✅ SSENSE scraper succeeded');
          console.log('Product extracted:', ssenseProduct.name, 'Price:', ssenseProduct.price);
        } catch (error) {
          console.log('⚠️ SSENSE scraper failed:', error.message);
          console.log('Using fallback data');
          ssenseProduct = scrapeSsenseFallback(url);
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
        
      case 'saksfifthavenue':
        console.log('💎 Using Saks Fifth Avenue scraper');
        const saksProduct = await scrapeSaksFifthAvenue(url);
        
        return {
          success: !saksProduct.error,
          product: {
            // Keep all original fields
            ...saksProduct,
            
            // Database schema fields
            product_name: saksProduct.name,
            brand: saksProduct.brand || 'Saks Fifth Avenue',
            original_price: saksProduct.originalPrice || saksProduct.price,
            sale_price: saksProduct.price,
            is_on_sale: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price,
            discount_percentage: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price ? 
              Math.round((1 - saksProduct.price / saksProduct.originalPrice) * 100) : null,
            sale_badge: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price ? 'SALE' : null,
            image_urls: saksProduct.images || [],
            vendor_url: saksProduct.url || url,
            color: saksProduct.color || '',
            colors: saksProduct.colors || [],
            category: detectCategory(
              saksProduct.name || '',
              saksProduct.description || '',
              saksProduct.brand || 'Saks Fifth Avenue',
              saksProduct.category
            ),
            material: saksProduct.materials?.join(', ') || '',
            description: saksProduct.description || '',
            sizes: saksProduct.sizes || [],
            sku: saksProduct.productId || '',
            in_stock: saksProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: saksProduct.name,
            price: saksProduct.price,
            images: saksProduct.images || [],
            originalPrice: saksProduct.originalPrice || saksProduct.price,
            isOnSale: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price,
            discountPercentage: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price ? 
              Math.round((1 - saksProduct.price / saksProduct.originalPrice) * 100) : null,
            saleBadge: saksProduct.originalPrice && saksProduct.originalPrice > saksProduct.price ? 'SALE' : null
          }
        };
        
      case 'poshmark':
        console.log('👗 Using Poshmark scraper');
        const poshmarkProduct = await scrapePoshmark(url);
        
        // Extract price number from string
        let poshmarkPriceNumeric = 0;
        if (poshmarkProduct.price) {
          const priceMatch = poshmarkProduct.price.match(/[\d,]+\.?\d*/);
          poshmarkPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let poshmarkOriginalPriceNumeric = poshmarkPriceNumeric;
        if (poshmarkProduct.originalPrice) {
          const originalMatch = poshmarkProduct.originalPrice.match(/[\d,]+\.?\d*/);
          poshmarkOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : poshmarkPriceNumeric;
        }
        
        const poshmarkIsOnSale = poshmarkProduct.originalPrice && poshmarkOriginalPriceNumeric > poshmarkPriceNumeric;
        
        return {
          success: !poshmarkProduct.error,
          product: {
            // Keep all original fields
            ...poshmarkProduct,
            
            // Database schema fields
            product_name: poshmarkProduct.name,
            brand: poshmarkProduct.brand || 'Poshmark Seller',
            original_price: poshmarkOriginalPriceNumeric,
            sale_price: poshmarkPriceNumeric,
            is_on_sale: poshmarkIsOnSale,
            discount_percentage: poshmarkIsOnSale ? 
              Math.round((1 - poshmarkPriceNumeric / poshmarkOriginalPriceNumeric) * 100) : null,
            sale_badge: poshmarkIsOnSale ? 'ON SALE' : null,
            image_urls: poshmarkProduct.images || [],
            vendor_url: poshmarkProduct.url || url,
            color: poshmarkProduct.color || '',
            category: detectCategory(
              poshmarkProduct.name || '',
              poshmarkProduct.description || '',
              poshmarkProduct.brand || 'Poshmark Seller',
              poshmarkProduct.category
            ),
            material: '',
            description: poshmarkProduct.description || '',
            sizes: poshmarkProduct.size ? [poshmarkProduct.size] : [],
            condition: poshmarkProduct.condition || 'Pre-owned',
            seller: poshmarkProduct.seller || '',
            in_stock: poshmarkProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: poshmarkProduct.name,
            price: poshmarkPriceNumeric,
            images: poshmarkProduct.images || [],
            originalPrice: poshmarkOriginalPriceNumeric,
            isOnSale: poshmarkIsOnSale,
            discountPercentage: poshmarkIsOnSale ? 
              Math.round((1 - poshmarkPriceNumeric / poshmarkOriginalPriceNumeric) * 100) : null,
            saleBadge: poshmarkIsOnSale ? 'ON SALE' : null
          }
        };
        
      case 'etsy':
        console.log('🛍️ Using Etsy scraper');
        const etsyProduct = await scrapeEtsy(url);
        
        // Extract price number from string
        let etsyPriceNumeric = 0;
        if (etsyProduct.price) {
          const priceMatch = etsyProduct.price.match(/[\d,]+\.?\d*/);
          etsyPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let etsyOriginalPriceNumeric = etsyPriceNumeric;
        if (etsyProduct.originalPrice) {
          const originalMatch = etsyProduct.originalPrice.match(/[\d,]+\.?\d*/);
          etsyOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : etsyPriceNumeric;
        }
        
        const etsyIsOnSale = etsyProduct.originalPrice && etsyOriginalPriceNumeric > etsyPriceNumeric;
        
        return {
          success: !etsyProduct.error,
          product: {
            // Keep all original fields
            ...etsyProduct,
            
            // Database schema fields
            product_name: etsyProduct.name,
            brand: etsyProduct.brand || 'Etsy Shop',
            original_price: etsyOriginalPriceNumeric,
            sale_price: etsyPriceNumeric,
            is_on_sale: etsyIsOnSale,
            discount_percentage: etsyIsOnSale ? 
              Math.round((1 - etsyPriceNumeric / etsyOriginalPriceNumeric) * 100) : null,
            sale_badge: etsyIsOnSale ? 'ON SALE' : null,
            image_urls: etsyProduct.images || [],
            vendor_url: etsyProduct.url || url,
            color: etsyProduct.colors?.join(', ') || '',
            category: detectCategory(
              etsyProduct.name || '',
              etsyProduct.description || '',
              etsyProduct.brand || 'Etsy Shop',
              null
            ),
            material: etsyProduct.material || '',
            description: etsyProduct.description || '',
            sizes: etsyProduct.sizes || [],
            rating: etsyProduct.rating || '',
            review_count: etsyProduct.reviewCount || '',
            shipping: etsyProduct.shipping || '',
            in_stock: etsyProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: etsyProduct.name,
            price: etsyPriceNumeric,
            images: etsyProduct.images || [],
            originalPrice: etsyOriginalPriceNumeric,
            isOnSale: etsyIsOnSale,
            discountPercentage: etsyIsOnSale ? 
              Math.round((1 - etsyPriceNumeric / etsyOriginalPriceNumeric) * 100) : null,
            saleBadge: etsyIsOnSale ? 'ON SALE' : null
          }
        };
      
      case 'shopstyle':
        console.log('🔗 Using ShopStyle scraper');
        const shopStyleProduct = await scrapeShopStyle(url);
        
        // Extract price number from string
        let shopStylePriceNumeric = 0;
        if (shopStyleProduct.price) {
          const priceMatch = shopStyleProduct.price.match(/[\d,]+\.?\d*/);
          shopStylePriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let shopStyleOriginalPriceNumeric = shopStylePriceNumeric;
        if (shopStyleProduct.originalPrice) {
          const originalMatch = shopStyleProduct.originalPrice.match(/[\d,]+\.?\d*/);
          shopStyleOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : shopStylePriceNumeric;
        }
        
        return {
          success: !shopStyleProduct.error,
          product: {
            // Keep all original fields
            ...shopStyleProduct,
            
            // Database schema fields
            product_name: shopStyleProduct.name,
            brand: shopStyleProduct.brand || shopStyleProduct.retailer || 'Unknown',
            original_price: shopStyleOriginalPriceNumeric,
            sale_price: shopStylePriceNumeric,
            is_on_sale: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric,
            discount_percentage: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric ? 
              Math.round((1 - shopStylePriceNumeric / shopStyleOriginalPriceNumeric) * 100) : null,
            sale_badge: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric ? 'SALE' : null,
            image_urls: shopStyleProduct.images || [],
            vendor_url: shopStyleProduct.url || url,
            category: detectCategory(
              shopStyleProduct.name || '',
              shopStyleProduct.description || '',
              shopStyleProduct.brand || '',
              null
            ),
            description: shopStyleProduct.description || '',
            in_stock: shopStyleProduct.inStock !== false,
            
            // Legacy fields
            name: shopStyleProduct.name,
            price: shopStylePriceNumeric,
            images: shopStyleProduct.images || [],
            originalPrice: shopStyleOriginalPriceNumeric,
            isOnSale: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric,
            discountPercentage: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric ? 
              Math.round((1 - shopStylePriceNumeric / shopStyleOriginalPriceNumeric) * 100) : null,
            saleBadge: shopStyleProduct.originalPrice && shopStyleOriginalPriceNumeric > shopStylePriceNumeric ? 'SALE' : null
          }
        };
        
      case 'redirect':
        console.log('🔄 Using redirect handler for affiliate/shortened URL');
        return await handleRedirect(url);
        
      case 'instagram':
        console.log('📸 Using Instagram scraper');
        const instagramData = await scrapeInstagram(url);
        
        // Format Instagram data as product
        return {
          success: !instagramData.error,
          product: {
            // Keep all original fields
            ...instagramData,
            
            // Database schema fields
            product_name: instagramData.name || 'Instagram Post',
            brand: instagramData.brand || 'Instagram',
            original_price: 0,
            sale_price: instagramData.price ? parseFloat(instagramData.price.replace(/[^0-9.]/g, '')) : 0,
            is_on_sale: false,
            image_urls: instagramData.images || [],
            vendor_url: instagramData.productUrl || url,
            description: instagramData.description || '',
            category: 'Social Media',
            platform: 'instagram',
            in_stock: true,
            
            // Legacy fields
            name: instagramData.name || 'Instagram Post',
            price: instagramData.price || 0,
            images: instagramData.images || [],
            originalPrice: 0,
            isOnSale: false
          }
        };
        
      case 'zara':
        console.log('🛍️ Using Zara scraper');
        const zaraProduct = await scrapeZara(url);
        
        // Extract price numbers
        let zaraPriceNumeric = 0;
        if (zaraProduct.price) {
          const priceMatch = zaraProduct.price.match(/[\d,]+\.?\d*/);
          zaraPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let zaraOriginalPriceNumeric = zaraPriceNumeric;
        if (zaraProduct.originalPrice) {
          const originalMatch = zaraProduct.originalPrice.match(/[\d,]+\.?\d*/);
          zaraOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : zaraPriceNumeric;
        }
        
        const zaraIsOnSale = zaraProduct.originalPrice && zaraOriginalPriceNumeric > zaraPriceNumeric;
        
        return {
          success: !zaraProduct.error,
          product: {
            // Keep all original fields
            ...zaraProduct,
            
            // Database schema fields
            product_name: zaraProduct.name,
            brand: 'Zara',
            original_price: zaraOriginalPriceNumeric,
            sale_price: zaraPriceNumeric,
            is_on_sale: zaraIsOnSale,
            discount_percentage: zaraIsOnSale ? 
              Math.round((1 - zaraPriceNumeric / zaraOriginalPriceNumeric) * 100) : null,
            sale_badge: zaraIsOnSale ? 'SALE' : null,
            image_urls: zaraProduct.images || [],
            vendor_url: zaraProduct.url || url,
            colors: zaraProduct.colors || [],
            sizes: zaraProduct.sizes || [],
            category: zaraProduct.category || detectCategory(
              zaraProduct.name || '',
              zaraProduct.description || '',
              'Zara',
              zaraProduct.category
            ),
            material: zaraProduct.materials?.join(', ') || '',
            description: zaraProduct.description || '',
            in_stock: zaraProduct.inStock !== false,
            sku: zaraProduct.productId || '',
            
            // Legacy fields
            name: zaraProduct.name,
            price: zaraPriceNumeric,
            images: zaraProduct.images || [],
            originalPrice: zaraOriginalPriceNumeric,
            isOnSale: zaraIsOnSale,
            discountPercentage: zaraIsOnSale ? 
              Math.round((1 - zaraPriceNumeric / zaraOriginalPriceNumeric) * 100) : null,
            saleBadge: zaraIsOnSale ? 'SALE' : null
          }
        };
        
      case 'shopify':
        console.log('🛍️ Using Shopify universal scraper');
        const shopifyProduct = await scrapeShopify(url);
        
        // Extract price number from string
        let shopifyPriceNumeric = 0;
        if (shopifyProduct.price) {
          const priceMatch = shopifyProduct.price.match(/[\d,]+\.?\d*/);
          shopifyPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let shopifyOriginalPriceNumeric = shopifyPriceNumeric;
        if (shopifyProduct.originalPrice) {
          const originalMatch = shopifyProduct.originalPrice.match(/[\d,]+\.?\d*/);
          shopifyOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : shopifyPriceNumeric;
        }
        
        const shopifyIsOnSale = shopifyProduct.originalPrice && shopifyOriginalPriceNumeric > shopifyPriceNumeric;
        
        return {
          success: !shopifyProduct.error,
          product: {
            // Keep all original fields
            ...shopifyProduct,
            
            // Database schema fields
            product_name: shopifyProduct.name,
            brand: shopifyProduct.brand || shopifyProduct.vendor || 'Unknown',
            original_price: shopifyOriginalPriceNumeric,
            sale_price: shopifyPriceNumeric,
            is_on_sale: shopifyIsOnSale,
            discount_percentage: shopifyIsOnSale ? 
              Math.round((1 - shopifyPriceNumeric / shopifyOriginalPriceNumeric) * 100) : null,
            sale_badge: shopifyIsOnSale ? 'SALE' : null,
            image_urls: shopifyProduct.images || [],
            vendor_url: shopifyProduct.url || url,
            colors: shopifyProduct.colors || [],
            sizes: shopifyProduct.sizes || [],
            category: detectCategory(
              shopifyProduct.name || '',
              shopifyProduct.description || '',
              shopifyProduct.brand || shopifyProduct.vendor || '',
              null
            ),
            description: shopifyProduct.description || '',
            in_stock: shopifyProduct.inStock !== false,
            variants: shopifyProduct.variants || [],
            
            // Legacy fields
            name: shopifyProduct.name,
            price: shopifyPriceNumeric,
            images: shopifyProduct.images || [],
            originalPrice: shopifyOriginalPriceNumeric,
            isOnSale: shopifyIsOnSale,
            discountPercentage: shopifyIsOnSale ? 
              Math.round((1 - shopifyPriceNumeric / shopifyOriginalPriceNumeric) * 100) : null,
            saleBadge: shopifyIsOnSale ? 'SALE' : null
          }
        };
      
      default:
        console.log('❌ No specific scraper available for this site');
        
        // Try to detect if it's a Shopify store dynamically
        console.log('🔍 Checking if site is Shopify...');
        const mightBeShopify = await isShopifyStore(url);
        
        if (mightBeShopify) {
          console.log('✅ Detected as Shopify store, using Shopify scraper');
          const shopifyProduct = await scrapeShopify(url);
          
          // Extract price number from string
          let shopifyPriceNumeric = 0;
          if (shopifyProduct.price) {
            const priceMatch = shopifyProduct.price.match(/[\d,]+\.?\d*/);
            shopifyPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
          }
          
          let shopifyOriginalPriceNumeric = shopifyPriceNumeric;
          if (shopifyProduct.originalPrice) {
            const originalMatch = shopifyProduct.originalPrice.match(/[\d,]+\.?\d*/);
            shopifyOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : shopifyPriceNumeric;
          }
          
          const shopifyIsOnSale = shopifyProduct.originalPrice && shopifyOriginalPriceNumeric > shopifyPriceNumeric;
          
          return {
            success: !shopifyProduct.error,
            product: {
              ...shopifyProduct,
              product_name: shopifyProduct.name,
              brand: shopifyProduct.brand || shopifyProduct.vendor || 'Unknown',
              original_price: shopifyOriginalPriceNumeric,
              sale_price: shopifyPriceNumeric,
              is_on_sale: shopifyIsOnSale,
              discount_percentage: shopifyIsOnSale ? 
                Math.round((1 - shopifyPriceNumeric / shopifyOriginalPriceNumeric) * 100) : null,
              sale_badge: shopifyIsOnSale ? 'SALE' : null,
              image_urls: shopifyProduct.images || [],
              vendor_url: shopifyProduct.url || url,
              category: detectCategory(
                shopifyProduct.name || '',
                shopifyProduct.description || '',
                shopifyProduct.brand || shopifyProduct.vendor || '',
                null
              ),
              name: shopifyProduct.name,
              price: shopifyPriceNumeric,
              images: shopifyProduct.images || [],
              originalPrice: shopifyOriginalPriceNumeric,
              isOnSale: shopifyIsOnSale,
              discountPercentage: shopifyIsOnSale ? 
                Math.round((1 - shopifyPriceNumeric / shopifyOriginalPriceNumeric) * 100) : null,
              saleBadge: shopifyIsOnSale ? 'SALE' : null
            }
          };
        }
        
        return {
          success: false,
          error: `No scraper available for ${site}`,
          product: null
        };
    }
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      product: null
    };
  }
};

module.exports = { scrapeProduct, detectSite };