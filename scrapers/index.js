// ============================================
// UNIVERSAL PARSER INTEGRATION - DO NOT DELETE
// ============================================
const UniversalParserV3 = require('../universal-parser-v3');
const { getMetricsCollector } = require('../monitoring/metrics-collector');
const { extractZaraImages, extractZaraProductId, extractZaraPrice } = require('./zara-image-extractor');
let universalParser;
let metricsCollector;

try {
  // Initialize Universal Parser V3 with all strategies
  universalParser = new UniversalParserV3();
  console.log('✅ Universal parser V3 initialized');

  // Initialize metrics collector if monitoring is enabled
  if (process.env.ENABLE_MONITORING !== 'false') {
    metricsCollector = getMetricsCollector();
    console.log('📊 Metrics collector initialized');
  }
} catch (e) {
  console.error('❌ Parser initialization failed:', e.message);
  universalParser = null;
}

// Universal parser wrapper with fallback
async function tryUniversalParser(url) {
  if (!universalParser) return null;

  try {
    const result = await universalParser.parse(url);
    console.log(`📊 Universal parser V3 confidence: ${result.confidence}`);

    // Return result with proper structure
    return {
      success: result.confidence > 0.5,
      product: normalizeToExistingFormat(result),
      extraction_method: 'universal_v3',
      confidence: result.confidence
    };
  } catch (error) {
    console.log('Universal parser error:', error.message);
    return null;
  }
}

// Convert universal parser output to match existing format
function normalizeToExistingFormat(data) {
  return {
    product_name: data.name,
    brand: data.brand || 'Unknown',
    original_price: data.price || 0,
    sale_price: data.sale_price || data.price || 0,
    is_on_sale: false,
    discount_percentage: null,
    image_urls: data.images || [],
    description: data.description || '',
    currency: data.currency || 'USD',
    availability: data.availability || 'in_stock',
    vendor_url: data.url,
    html: data.html || data._rawHtml,  // Preserve HTML for post-processors

    // Legacy fields for compatibility
    name: data.name,
    price: data.price || 0,
    images: data.images || [],
    url: data.url,
    sku: data.sku,
    category: '',
    sizes: [],
    colors: [],
    material: ''
  };
}
// ============================================
// END UNIVERSAL PARSER INTEGRATION
// ============================================

// EXISTING IMPORTS - DO NOT MODIFY
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
const { scrapeUrbanOutfitters } = require('./urbanoutfitters');
const { scrapeFreePeople } = require('./freepeople');
const { scrapeRevolve } = require('./revolve');
const { scrapeNetAPorter } = require('./netaporter');
const { scrapeAsos } = require('./asos');
const { scrapeReformation } = require('./reformation');
const { scrapeEverlane } = require('./everlane');
const { scrapeAnthropologie } = require('./anthropologie');
const { scrapeMadewell } = require('./madewell');
const { scrapeAritzia } = require('./aritzia');
const { scrapeLululemon } = require('./lululemon');
const { scrapeFarfetch } = require('./farfetch');
const { scrapeStories } = require('./stories');
const { scrapeMytheresa, isMytheresaStore } = require('./mytheresa');
const { scrapeClothbase, isClothbase } = require('./clothbase');
const { scrapeArcteryx, isArcteryx } = require('./arcteryx');
const { scrapeSongForTheMute, isSongForTheMute } = require('./songforthemute');
const { scrapeMassimoDutti } = require('./massimodutti');
const scrapeCamperlab = require('./camperlab');
const { scrapeUnijay } = require('./unijay');
const { scrapeFWRD } = require('./fwrd');
const { scrapeMiuMiu } = require('./miumiu');
const { scrapeChiclara } = require('./chiclara');
const { scrapeGalleryDept } = require('./gallerydept');
const { scrapeBoden } = require('./boden');
const { scrapeWConcept } = require('./wconcept');
// const { scrapeArket } = require('./arket'); // Removed - Arket blocks HTTP, uses Universal Parser
const { detectCategory } = require('../utils/categoryDetection');
const FirecrawlParser = require('./firecrawl-parser');
const FirecrawlParserV2 = require('./firecrawl-parser-v2');

// Initialize Firecrawl parsers
let firecrawlParser = null;
let firecrawlParserV2 = null;

// Initialize V1 parser (legacy)
try {
  firecrawlParser = new FirecrawlParser();
  if (firecrawlParser.apiKey) {
    console.log('🔥 Firecrawl parser V1 initialized (legacy)');
  }
} catch (e) {
  console.log('⚠️ Firecrawl V1 not available:', e.message);
}

// Initialize V2 parser (optimized)
try {
  firecrawlParserV2 = new FirecrawlParserV2();
  if (firecrawlParserV2.apiKey) {
    console.log('✨ Firecrawl parser V2 initialized (optimized)');
  }
} catch (e) {
  console.log('⚠️ Firecrawl V2 not available:', e.message);
}

// ============================================
// AUTO-DISCOVERY SCRAPER REGISTRY
// ============================================
// Automatically load all scrapers using convention-based naming
// Convention: Each scraper file exports a function named scrape[SiteName]
// Example: arket.js exports scrapeArket, amazon.js exports scrapeAmazonProduct
const fs = require('fs');
const path = require('path');

const SCRAPER_REGISTRY = {};

// Auto-load all scrapers from the current directory
try {
  const scrapersDir = __dirname;
  const scraperFiles = fs.readdirSync(scrapersDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js');

  scraperFiles.forEach(file => {
    const siteName = file.replace('.js', '');
    try {
      const scraperModule = require(`./${file}`);

      // Try different naming conventions
      const possibleNames = [
        `scrape${siteName.charAt(0).toUpperCase() + siteName.slice(1)}`, // scrapeArket
        `scrape${siteName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`, // scrapeSomeMultiWord
        `scrape${siteName.toUpperCase()}`, // scrapeCOS
        `scrape${siteName}` // scrapearket (fallback)
      ];

      for (const fnName of possibleNames) {
        if (typeof scraperModule[fnName] === 'function') {
          SCRAPER_REGISTRY[siteName] = scraperModule[fnName];
          console.log(`📦 Registered scraper: ${siteName} -> ${fnName}()`);
          break;
        }
      }
    } catch (e) {
      // Skip files that can't be loaded (helpers, etc.)
    }
  });

  console.log(`✅ Auto-discovered ${Object.keys(SCRAPER_REGISTRY).length} scrapers`);
} catch (e) {
  console.error('⚠️ Auto-discovery failed:', e.message);
}

/**
 * Normalize SSENSE product data into the expected schema
 */
function normalizeSsenseProduct(rawProduct = {}, url) {
  if (!rawProduct) return null;

  const productName = rawProduct.product_name || rawProduct.name || rawProduct.title || '';
  const brand = rawProduct.brand?.name || rawProduct.brand || 'SSENSE';

  const salePriceRaw = rawProduct.sale_price ?? rawProduct.price ?? 0;
  const salePrice = typeof salePriceRaw === 'number'
    ? salePriceRaw
    : parseFloat(String(salePriceRaw).replace(/[^\d.]/g, '')) || 0;

  const originalPriceRaw = rawProduct.original_price ?? rawProduct.originalPrice ?? salePrice;
  const originalPrice = typeof originalPriceRaw === 'number'
    ? originalPriceRaw
    : parseFloat(String(originalPriceRaw).replace(/[^\d.]/g, '')) || salePrice;

  const computedDiscount = originalPrice > salePrice && salePrice > 0
    ? Math.round((1 - salePrice / originalPrice) * 100)
    : null;

  const images = rawProduct.image_urls || rawProduct.images || [];

  return {
    product_name: productName,
    brand,
    original_price: originalPrice,
    sale_price: salePrice,
    is_on_sale: rawProduct.is_on_sale ?? rawProduct.isOnSale ?? (computedDiscount !== null),
    discount_percentage: rawProduct.discount_percentage ?? rawProduct.discountPercentage ?? computedDiscount,
    sale_badge: rawProduct.sale_badge ?? rawProduct.saleBadge ?? (computedDiscount ? `${computedDiscount}% OFF` : null),
    image_urls: images,
    vendor_url: rawProduct.vendor_url || rawProduct.url || url,
    description: rawProduct.description || '',
    color: rawProduct.color || '',
    category: rawProduct.category || detectCategory(
      productName,
      rawProduct.description || '',
      brand,
      rawProduct.category
    ),
    material: rawProduct.material ||
      (Array.isArray(rawProduct.materials) ? rawProduct.materials.join(', ') : ''),
    platform: rawProduct.platform || 'ssense',
    currency: rawProduct.currency || 'USD',

    // Legacy fields
    name: productName,
    price: salePrice,
    images,
    originalPrice,
    isOnSale: rawProduct.is_on_sale ?? rawProduct.isOnSale ?? (computedDiscount !== null),
    discountPercentage: rawProduct.discount_percentage ?? rawProduct.discountPercentage ?? computedDiscount,
    saleBadge: rawProduct.sale_badge ?? rawProduct.saleBadge ?? (computedDiscount ? `${computedDiscount}% OFF` : null)
  };
}

/**
 * Attempt multiple SSENSE scraping strategies (simple -> puppeteer -> fallback -> Firecrawl)
 */
async function scrapeSsenseWithFallbacks(url, { allowFirecrawl = true } = {}) {
  const strategies = [
    {
      name: 'SSENSE simple scraper',
      runner: async () => {
        const result = await scrapeSsenseSimple(url);
        return result ? { success: true, product: normalizeSsenseProduct(result, url) } : null;
      }
    },
    {
      name: 'SSENSE Puppeteer scraper',
      runner: async () => {
        const result = await scrapeSsense(url);
        return result ? { success: true, product: normalizeSsenseProduct(result, url) } : null;
      }
    },
    {
      name: 'SSENSE fallback scraper',
      runner: async () => {
        const result = await scrapeSsenseFallback(url);
        if (result?.blocked) {
          return {
            success: false,
            blocked: true,
            error: result.message || 'SSENSE is blocking automated requests',
            product: normalizeSsenseProduct(result, url)
          };
        }
        return result ? { success: true, product: normalizeSsenseProduct(result, url) } : null;
      }
    }
  ];

  if (allowFirecrawl) {
    const selectedParser = getFirecrawlParser();
    if (selectedParser) {
      strategies.push({
        name: 'Firecrawl parser (fallback)',
        runner: async () => {
          const firecrawlResult = await selectedParser.scrape(url);
          if (!firecrawlResult?.success) {
            throw new Error(firecrawlResult?.error || 'Firecrawl scrape failed');
          }
          return {
            success: true,
            product: normalizeSsenseProduct(firecrawlResult.product, url)
          };
        }
      });
    }
  }

  const errors = [];

  for (const strategy of strategies) {
    try {
      console.log(`🔄 Attempting ${strategy.name}...`);
      const result = await strategy.runner();

      if (!result) {
        console.log(`ℹ️ ${strategy.name} returned no data, moving on...`);
        continue;
      }

      if (result.blocked) {
        console.warn(`🚫 ${strategy.name} indicates SSENSE is blocking requests`);
        return {
          success: false,
          error: result.error || 'SSENSE is blocking requests',
          blocked: true,
          product: result.product || null
        };
      }

      if (result.success && result.product) {
        console.log(`✅ ${strategy.name} succeeded`);
        return {
          success: true,
          product: result.product
        };
      }

      if (result.error) {
        errors.push({ strategy: strategy.name, error: result.error });
      }
    } catch (err) {
      const message = err?.message || 'Unknown error';
      errors.push({ strategy: strategy.name, error: message });
      console.error(`❌ ${strategy.name} failed:`, message);
    }
  }

  console.error('❌ All SSENSE strategies failed', errors);

  return {
    success: false,
    error: 'All SSENSE strategies failed',
    details: errors
  };
}

// Helper function to get scraper by site name
function getScraperFunction(siteName) {
  return SCRAPER_REGISTRY[siteName] || null;
}

// A/B testing configuration
const FIRECRAWL_V2_ENABLED = process.env.FIRECRAWL_V2 !== 'false'; // Default to true
const FIRECRAWL_V2_PERCENTAGE = parseInt(process.env.FIRECRAWL_V2_PERCENTAGE || '100'); // Default 100%

// Determine which parser to use
function getFirecrawlParser() {
  // If V2 is disabled, use V1
  if (!FIRECRAWL_V2_ENABLED || !firecrawlParserV2) {
    return firecrawlParser;
  }

  // If V1 doesn't exist, use V2
  if (!firecrawlParser) {
    return firecrawlParserV2;
  }

  // A/B testing based on percentage
  const useV2 = Math.random() * 100 < FIRECRAWL_V2_PERCENTAGE;

  if (useV2) {
    console.log('📊 A/B Test: Using Firecrawl V2');
    return firecrawlParserV2;
  } else {
    console.log('📊 A/B Test: Using Firecrawl V1');
    return firecrawlParser;
  }
}

// List of sites that require Firecrawl due to enterprise bot detection
// These sites will ALWAYS use Firecrawl as primary method
const FIRECRAWL_REQUIRED_SITES = [
  'rei.com',  // REI has strong bot detection, always use Firecrawl
  'ralphlauren.com',  // Ralph Lauren blocks standard scrapers, use Firecrawl
  'net-a-porter.com',  // Net-a-Porter has enterprise bot protection, use Firecrawl
  'aritzia.com'  // Aritzia returns 403 for all standard requests, use Firecrawl
];

// Sites that can use Firecrawl as fallback if primary scraper fails
const FIRECRAWL_FALLBACK_SITES = [
  // SSENSE moved to FIRECRAWL_REQUIRED_SITES for better image quality
];

// Site detection function
const detectSite = (url) => {
  const hostname = new URL(url).hostname.toLowerCase();

  // SSENSE uses dedicated scrapers with Firecrawl fallback
  if (hostname.includes('ssense.com')) {
    return 'ssense';
  }

  // Check if site requires Firecrawl
  const requiresFirecrawl = FIRECRAWL_REQUIRED_SITES.some(site =>
    hostname.includes(site)
  );

  // Check if any Firecrawl parser is available
  const hasFirecrawlParser = (firecrawlParser?.apiKey) || (firecrawlParserV2?.apiKey);

  if (requiresFirecrawl && hasFirecrawlParser) {
    return 'firecrawl';
  }

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
  if (hostname === 'cos.com' || hostname === 'www.cos.com' || hostname.startsWith('cos.')) {
    return 'cos';
  }
  if (hostname.includes('sezane.')) {
    return 'sezane';
  }
  if (hostname.includes('nordstrom.')) {
    return 'nordstrom';
  }
  // SSENSE removed from here - handled by FIRECRAWL_REQUIRED_SITES above
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
  // Commented out - let Universal/Firecrawl handle Zara since dedicated scraper can't get images
  // if (hostname.includes('zara.com')) {
  //   return 'zara';
  // }
  if (hostname.includes('urbanoutfitters.')) {
    return 'urbanoutfitters';
  }
  // Commented out - let Universal Parser handle Free People instead
  // if (hostname.includes('freepeople.')) {
  //   return 'freepeople';
  // }
  if (hostname.includes('revolve.')) {
    return 'revolve';
  }
  if (hostname.includes('net-a-porter.')) {
    return 'netaporter';
  }
  if (hostname.includes('asos.')) {
    return 'asos';
  }
  if (hostname.includes('reformation.')) {
    return 'reformation';
  }
  if (hostname.includes('everlane.')) {
    return 'everlane';
  }
  if (hostname.includes('anthropologie.')) {
    return 'anthropologie';
  }
  if (hostname.includes('madewell.')) {
    return 'madewell';
  }
  // Aritzia removed - now handled by FIRECRAWL_REQUIRED_SITES above
  if (hostname.includes('lululemon.')) {
    return 'lululemon';
  }
  if (hostname.includes('stories.')) {
    return 'stories';
  }
  if (hostname.includes('mytheresa.')) {
    return 'mytheresa';
  }
  if (hostname.includes('clothbase.')) {
    return 'clothbase';
  }
  if (hostname.includes('arcteryx.')) {
    return 'arcteryx';
  }
  if (hostname.includes('songforthemute.')) {
    return 'songforthemute';
  }
  if (hostname.includes('massimodutti.')) {
    return 'massimodutti';
  }
  if (hostname.includes('camperlab.')) {
    return 'camperlab';
  }
  if (hostname.includes('fwrd.')) {
    return 'fwrd';
  }
  if (hostname.includes('miumiu.')) {
    return 'miumiu';
  }
  if (hostname.includes('chiclara.')) {
    return 'chiclara';
  }
  if (hostname.includes('gallerydept.')) {
    return 'gallerydept';
  }
  if (hostname.includes('unijay.')) {
    return 'unijay';
  }
  if (hostname.includes('boden.')) {
    return 'boden';
  }
  if (hostname.includes('wconcept.')) {
    return 'wconcept';
  }
  // Note: arket.com requires JavaScript rendering, handled by Universal Parser
  // if (hostname.includes('arket.')) {
  //   return 'arket';
  // }

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
    'gimaguas.com',
    'footindustry.com',
    'shopcatandkate.com'
  ];
  
  for (const domain of shopifyDomains) {
    if (hostname.includes(domain)) {
      return 'shopify';
    }
  }
  
  return null; // Let unknown sites fall through to default case for Shopify detection
};

// Main scraping function with site routing
const scrapeProduct = async (url, options = {}) => {
  console.log('🔍 Detecting site for:', url);

  // Start timing for metrics
  const startTime = Date.now();
  let universalResult = null;
  let specificResult = null;

  // Check if URL is from sites with dedicated scrapers that work better
  const hostname = new URL(url).hostname.replace('www.', '');

  // Sites to skip Universal Parser for - they have optimized dedicated scrapers
  const skipUniversalSites = [
    // 'zara.com', // Commented out - let Universal/Firecrawl handle Zara since dedicated scraper can't get images
    'amazon.com',
    'ebay.com',
    'etsy.com',
    'nordstrom.com',
    'saksfifthavenue.com',
    'saks.com',
    'wconcept.com',
    'ssense.com'
  ];

  const shouldSkipUniversal = skipUniversalSites.some(site => hostname.includes(site));

  if (shouldSkipUniversal) {
    console.log(`⚡ ${hostname} detected - skipping Universal Parser for optimal performance`);
  }

  // ============================================
  // TRY UNIVERSAL PARSER FIRST (AS PER PLAN)
  // ============================================
  // Skip Universal Parser for sites with optimized dedicated scrapers
  if (!shouldSkipUniversal && !options.skipUniversal && process.env.UNIVERSAL_MODE !== 'off') {
    const mode = process.env.UNIVERSAL_MODE || 'full';  // Changed default to 'full'

    if (mode === 'shadow') {
      // Shadow mode: run but don't use results
      universalResult = await tryUniversalParser(url);
      if (universalResult) {
        console.log('🔬 [SHADOW MODE] Universal parser would have returned:', {
          confidence: universalResult.confidence,
          hasData: !!(universalResult.product?.name && universalResult.product?.price)
        });
      }
    } else if (mode === 'full' || mode === 'partial') {
      // Full mode: Try Universal Parser first
      universalResult = await tryUniversalParser(url);

      if (universalResult && universalResult.confidence > 0.7) {
        console.log('✅ Universal Parser succeeded with confidence:', universalResult.confidence);

        // Collect metrics if enabled
        if (metricsCollector) {
          metricsCollector.recordScrape({
            url,
            success: true,
            method: 'universal',
            confidence: universalResult.confidence,
            duration: Date.now() - startTime
          });
        }

        return universalResult;
      }

      console.log('📊 Universal Parser confidence too low:', universalResult?.confidence || 0);
    } else if (mode === 'partial-old') {
      // Partial mode: only use for specific sites
      const allowedSites = (process.env.UNIVERSAL_SITES || 'zara.com,hm.com').split(',');
      const hostname = new URL(url).hostname.replace('www.', '');

      if (allowedSites.some(site => hostname.includes(site))) {
        universalResult = await tryUniversalParser(url);
        if (universalResult) {
          console.log('✅ Universal parser succeeded (partial mode)');

          // Record metrics
          if (metricsCollector) {
            await metricsCollector.recordRequest(url, universalResult, universalResult, {
              startTime,
              endTime: Date.now()
            });
          }

          return universalResult;
        }
      }
    } else if (mode === 'full') {
      // Full mode: try universal parser for all sites
      universalResult = await tryUniversalParser(url);
      if (universalResult) {
        console.log('✅ Universal parser succeeded');

        // Record metrics
        if (metricsCollector) {
          await metricsCollector.recordRequest(url, universalResult, universalResult, {
            startTime,
            endTime: Date.now()
          });
        }

        return universalResult;
      }
      console.log('📌 Falling back to site-specific scraper');
    }
  }
  // ============================================
  // END UNIVERSAL PARSER INTEGRATION
  // ============================================

  const site = detectSite(url);
  console.log('🏷️ Detected site:', site);

  try {
    switch (site) {
      case 'firecrawl': {
        console.log('🔥 Using Firecrawl for enterprise bot detection bypass');
        const selectedParser = getFirecrawlParser();

        const respondWithFirecrawlResult = (firecrawlResult) => {
          if (firecrawlResult?.success) {
            const product = firecrawlResult.product;
            product.category = detectCategory(
              product.product_name || '',
              product.description || '',
              product.brand || '',
              null
            );

            return {
              success: true,
              product
            };
          }
          return firecrawlResult || {
            success: false,
            error: 'Firecrawl parsing failed'
          };
        };

        if (!selectedParser) {
          console.log('❌ No Firecrawl parser available');
          if (hostname.includes('ssense.com')) {
            return await scrapeSsenseWithFallbacks(url, { allowFirecrawl: false });
          }
          return {
            success: false,
            error: 'Firecrawl parser not configured'
          };
        }

        let firecrawlResult;
        try {
          firecrawlResult = await selectedParser.scrape(url);
        } catch (error) {
          console.error('❌ Firecrawl parser threw an error:', error.message);
          firecrawlResult = {
            success: false,
            error: error.message || 'Firecrawl parser error'
          };
        }

        if (firecrawlResult?.success) {
          return respondWithFirecrawlResult(firecrawlResult);
        }

        console.log('⚠️ Firecrawl parsing failed');

        if (hostname.includes('ssense.com')) {
          const fallback = await scrapeSsenseWithFallbacks(url, { allowFirecrawl: false });
          if (fallback) {
            return fallback;
          }
        }

        return respondWithFirecrawlResult(firecrawlResult);
      }

      case 'ssense': {
        console.log('🧥 Using dedicated SSENSE scrapers');
        return await scrapeSsenseWithFallbacks(url, { allowFirecrawl: true });
      }

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
        
      // SSENSE case removed - now handled by 'firecrawl' case above
      // SSENSE is in FIRECRAWL_REQUIRED_SITES for high-resolution image extraction

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
        
        // Prepare product data for Quality Gate validation
        const productData = {
          name: zaraProduct.name,
          brand: 'Zara',
          price: zaraPriceNumeric,
          images: zaraProduct.images || [],
          description: zaraProduct.description || '',
          sale_price: zaraIsOnSale ? zaraPriceNumeric : null,
          currency: 'USD',
          url: url
        };
        
        // Check for Zara-specific image issues (static.zara.net URLs often return 404)
        const hasInaccessibleImages = productData.images && productData.images.length > 0 &&
          productData.images.every(img => img.includes('static.zara.net'));

        if (hasInaccessibleImages) {
          console.log(`⚠️ Warning: Zara product has potentially inaccessible images (static.zara.net URLs)`);
          console.log(`⚠️ Returning product data without images due to Zara's anti-bot protection`);

          // Clear the invalid images from both objects
          productData.images = [];
          productData.image_urls = [];
          zaraProduct.images = [];  // Also clear from original product object

          // Add a note about missing images
          productData.notes = 'Images could not be extracted due to Zara anti-bot protection. Product details are accurate.';
        }
        
        console.log(`✅ Zara product passed Quality Gate validation`);
        
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
        
        // Extract price number (handle both string and number formats)
        let shopifyPriceNumeric = 0;
        if (shopifyProduct.price) {
          if (typeof shopifyProduct.price === 'number') {
            shopifyPriceNumeric = shopifyProduct.price;
          } else if (typeof shopifyProduct.price === 'string') {
            const priceMatch = shopifyProduct.price.match(/[\d,]+\.?\d*/);
            shopifyPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
          }
        }

        let shopifyOriginalPriceNumeric = shopifyPriceNumeric;
        if (shopifyProduct.originalPrice) {
          if (typeof shopifyProduct.originalPrice === 'number') {
            shopifyOriginalPriceNumeric = shopifyProduct.originalPrice;
          } else if (typeof shopifyProduct.originalPrice === 'string') {
            const originalMatch = shopifyProduct.originalPrice.match(/[\d,]+\.?\d*/);
            shopifyOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : shopifyPriceNumeric;
          }
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
      
      case 'urbanoutfitters':
        console.log('🏙️ Using Urban Outfitters scraper');
        return await scrapeUrbanOutfitters(url);
        
      // Commented out - let Universal Parser handle Free People instead
      // case 'freepeople':
      //   console.log('🌻 Using Free People scraper');
      //   return await scrapeFreePeople(url);
        
      case 'revolve':
        console.log('🌟 Using Revolve scraper');
        return await scrapeRevolve(url);
        
      case 'netaporter':
        console.log('💎 Using Net-a-Porter scraper');
        return await scrapeNetAPorter(url);
        
      case 'asos':
        console.log('🛍️ Using ASOS scraper');
        return await scrapeAsos(url);
        
      case 'reformation':
        console.log('🌱 Using Reformation scraper');
        return await scrapeReformation(url);
        
      case 'everlane':
        console.log('♻️ Using Everlane scraper');
        return await scrapeEverlane(url);
        
      case 'anthropologie':
        console.log('🌺 Using Anthropologie scraper');
        return await scrapeAnthropologie(url);
        
      case 'madewell':
        console.log('👖 Using Madewell scraper');
        return await scrapeMadewell(url);

      case 'lululemon':
        console.log('🍋 Using Lululemon scraper');
        return await scrapeLululemon(url);
      
      case 'stories':
        console.log('👗 Using Stories scraper');
        const storiesProduct = await scrapeStories(url);
        
        // Check if we need to fallback to generic scraper
        if (storiesProduct.needsPuppeteer && !storiesProduct.name) {
          console.log('⚠️ Stories requires Puppeteer, but generic scraper not available');
          // return await scrapeGeneric(url); // TODO: Implement generic scraper
          return {
            success: false,
            error: 'Generic scraper not implemented',
            product: null
          };
        }
        
        // Extract price number from string
        const storiesPriceMatch = storiesProduct.price?.match(/[\d,]+\.?\d*/);
        const storiesPriceNumeric = storiesPriceMatch ? parseFloat(storiesPriceMatch[0].replace(',', '')) : 0;
        
        const storiesOriginalPriceMatch = storiesProduct.originalPrice?.match(/[\d,]+\.?\d*/);
        const storiesOriginalPriceNumeric = storiesOriginalPriceMatch ? parseFloat(storiesOriginalPriceMatch[0].replace(',', '')) : storiesPriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...storiesProduct,
            
            // Database schema fields
            product_name: storiesProduct.name,
            brand: storiesProduct.brand || 'Stories',
            original_price: storiesOriginalPriceNumeric,
            sale_price: storiesPriceNumeric,
            is_on_sale: storiesProduct.isOnSale || false,
            discount_percentage: storiesProduct.isOnSale && storiesOriginalPriceNumeric > 0 
              ? Math.round((1 - storiesPriceNumeric / storiesOriginalPriceNumeric) * 100)
              : null,
            sale_badge: storiesProduct.isOnSale ? 'SALE' : null,
            image_urls: storiesProduct.images || [],
            vendor_url: storiesProduct.url,
            color: storiesProduct.color || '',
            category: detectCategory(
              storiesProduct.name || '',
              storiesProduct.description || '',
              storiesProduct.brand || 'Stories',
              storiesProduct.category
            ),
            material: '',
            
            // Legacy fields for backward compatibility
            price: storiesPriceNumeric,
            images: storiesProduct.images || [],
            originalPrice: storiesOriginalPriceNumeric,
            isOnSale: storiesProduct.isOnSale || false,
            discountPercentage: storiesProduct.isOnSale && storiesOriginalPriceNumeric > 0
              ? Math.round((1 - storiesPriceNumeric / storiesOriginalPriceNumeric) * 100)
              : null,
            saleBadge: storiesProduct.isOnSale ? 'SALE' : null
          }
        };
      
      case 'mytheresa':
        console.log('🛍️ Using Mytheresa scraper');
        const mytheresaProduct = await scrapeMytheresa(url);
        
        // Extract price number from string
        let mytheresaPriceNumeric = 0;
        if (mytheresaProduct.price) {
          const priceMatch = mytheresaProduct.price.match(/[\d,]+\.?\d*/);
          mytheresaPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let mytheresaOriginalPriceNumeric = mytheresaPriceNumeric;
        if (mytheresaProduct.originalPrice) {
          const originalMatch = mytheresaProduct.originalPrice.match(/[\d,]+\.?\d*/);
          mytheresaOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : mytheresaPriceNumeric;
        }
        
        const mytheresaIsOnSale = mytheresaProduct.originalPrice && mytheresaOriginalPriceNumeric > mytheresaPriceNumeric;
        
        return {
          success: !mytheresaProduct.error,
          product: {
            // Keep all original fields
            ...mytheresaProduct,
            
            // Database schema fields
            product_name: mytheresaProduct.name,
            brand: mytheresaProduct.brand || 'Mytheresa',
            original_price: mytheresaOriginalPriceNumeric,
            sale_price: mytheresaPriceNumeric,
            is_on_sale: mytheresaIsOnSale,
            discount_percentage: mytheresaIsOnSale ? 
              Math.round((1 - mytheresaPriceNumeric / mytheresaOriginalPriceNumeric) * 100) : null,
            sale_badge: mytheresaIsOnSale ? 'SALE' : null,
            image_urls: mytheresaProduct.images || [],
            vendor_url: mytheresaProduct.url || url,
            color: mytheresaProduct.color || '',
            colors: mytheresaProduct.colors || [],
            sizes: mytheresaProduct.sizes || [],
            category: detectCategory(
              mytheresaProduct.name || '',
              mytheresaProduct.description || '',
              mytheresaProduct.brand || 'Mytheresa',
              mytheresaProduct.category
            ),
            material: mytheresaProduct.material || '',
            description: mytheresaProduct.description || '',
            in_stock: mytheresaProduct.inStock !== false,
            sku: mytheresaProduct.sku || '',
            
            // Legacy fields
            name: mytheresaProduct.name,
            price: mytheresaPriceNumeric,
            images: mytheresaProduct.images || [],
            originalPrice: mytheresaOriginalPriceNumeric,
            isOnSale: mytheresaIsOnSale,
            discountPercentage: mytheresaIsOnSale ? 
              Math.round((1 - mytheresaPriceNumeric / mytheresaOriginalPriceNumeric) * 100) : null,
            saleBadge: mytheresaIsOnSale ? 'SALE' : null
          }
        };
      
      case 'songforthemute':
        console.log('🎵 Using Song for the Mute scraper');
        const sftmProduct = await scrapeSongForTheMute(url);
        
        // Extract price number from string
        let sftmPriceNumeric = 0;
        if (sftmProduct.price) {
          const priceMatch = sftmProduct.price.match(/[\d,]+\.?\d*/);
          sftmPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let sftmOriginalPriceNumeric = sftmPriceNumeric;
        if (sftmProduct.originalPrice) {
          const originalMatch = sftmProduct.originalPrice.match(/[\d,]+\.?\d*/);
          sftmOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : sftmPriceNumeric;
        }
        
        const sftmIsOnSale = sftmProduct.originalPrice && sftmOriginalPriceNumeric > sftmPriceNumeric;
        
        return {
          success: !sftmProduct.error,
          product: {
            // Keep all original fields
            ...sftmProduct,
            
            // Database schema fields
            product_name: sftmProduct.name,
            brand: sftmProduct.brand || 'Song for the Mute',
            original_price: sftmOriginalPriceNumeric,
            sale_price: sftmPriceNumeric,
            is_on_sale: sftmIsOnSale,
            discount_percentage: sftmIsOnSale ? 
              Math.round((1 - sftmPriceNumeric / sftmOriginalPriceNumeric) * 100) : null,
            sale_badge: sftmIsOnSale ? 'SALE' : null,
            image_urls: sftmProduct.images || [],
            vendor_url: sftmProduct.url || url,
            color: sftmProduct.colors?.length > 0 ? sftmProduct.colors[0] : '',
            colors: sftmProduct.colors || [],
            sizes: sftmProduct.sizes || [],
            category: detectCategory(
              sftmProduct.name || '',
              sftmProduct.description || '',
              sftmProduct.brand || 'Song for the Mute',
              sftmProduct.category
            ),
            material: sftmProduct.material || '',
            description: sftmProduct.description || '',
            
            // Legacy fields for backward compatibility
            name: sftmProduct.name,
            price: sftmPriceNumeric,
            images: sftmProduct.images || [],
            originalPrice: sftmOriginalPriceNumeric,
            isOnSale: sftmIsOnSale,
            discountPercentage: sftmIsOnSale ? 
              Math.round((1 - sftmPriceNumeric / sftmOriginalPriceNumeric) * 100) : null,
            saleBadge: sftmIsOnSale ? 'SALE' : null
          }
        };
      
      case 'arcteryx':
        console.log('🏔️ Using Arc\'teryx scraper');
        const arcteryxProduct = await scrapeArcteryx(url);
        
        // Extract price number from string
        let arcteryxPriceNumeric = 0;
        if (arcteryxProduct.price) {
          const priceMatch = arcteryxProduct.price.match(/[\d,]+\.?\d*/);
          arcteryxPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let arcteryxOriginalPriceNumeric = arcteryxPriceNumeric;
        if (arcteryxProduct.originalPrice) {
          const originalMatch = arcteryxProduct.originalPrice.match(/[\d,]+\.?\d*/);
          arcteryxOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : arcteryxPriceNumeric;
        }
        
        const arcteryxIsOnSale = arcteryxProduct.originalPrice && arcteryxOriginalPriceNumeric > arcteryxPriceNumeric;
        
        return {
          success: !arcteryxProduct.error,
          product: {
            // Keep all original fields
            ...arcteryxProduct,
            
            // Database schema fields
            product_name: arcteryxProduct.name,
            brand: arcteryxProduct.brand || 'Arc\'teryx',
            original_price: arcteryxOriginalPriceNumeric,
            sale_price: arcteryxPriceNumeric,
            is_on_sale: arcteryxIsOnSale,
            discount_percentage: arcteryxIsOnSale ? 
              Math.round((1 - arcteryxPriceNumeric / arcteryxOriginalPriceNumeric) * 100) : null,
            sale_badge: arcteryxIsOnSale ? 'SALE' : null,
            image_urls: arcteryxProduct.images || [],
            vendor_url: arcteryxProduct.url || url,
            color: arcteryxProduct.colors?.length > 0 ? arcteryxProduct.colors[0] : '',
            colors: arcteryxProduct.colors || [],
            sizes: arcteryxProduct.sizes || [],
            category: detectCategory(
              arcteryxProduct.name || '',
              arcteryxProduct.description || '',
              arcteryxProduct.brand || 'Arc\'teryx',
              arcteryxProduct.category
            ),
            material: arcteryxProduct.material || '',
            description: arcteryxProduct.description || '',
            features: arcteryxProduct.features || [],
            weight: arcteryxProduct.weight || '',
            sku: arcteryxProduct.sku || '',
            in_stock: arcteryxProduct.inStock !== false,
            retailer: arcteryxProduct.retailer || 'Arc\'teryx',
            
            // Legacy fields for backward compatibility
            name: arcteryxProduct.name,
            price: arcteryxPriceNumeric,
            images: arcteryxProduct.images || [],
            originalPrice: arcteryxOriginalPriceNumeric,
            isOnSale: arcteryxIsOnSale,
            discountPercentage: arcteryxIsOnSale ? 
              Math.round((1 - arcteryxPriceNumeric / arcteryxOriginalPriceNumeric) * 100) : null,
            saleBadge: arcteryxIsOnSale ? 'SALE' : null
          }
        };
        
      case 'clothbase':
        console.log('👔 Using Clothbase scraper');
        const clothbaseProduct = await scrapeClothbase(url);
        
        // Extract price number from string
        let clothbasePriceNumeric = 0;
        if (clothbaseProduct.price) {
          const priceMatch = clothbaseProduct.price.match(/[\d,]+\.?\d*/);
          clothbasePriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
        }
        
        let clothbaseOriginalPriceNumeric = clothbasePriceNumeric;
        if (clothbaseProduct.originalPrice) {
          const originalMatch = clothbaseProduct.originalPrice.match(/[\d,]+\.?\d*/);
          clothbaseOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : clothbasePriceNumeric;
        }
        
        const clothbaseIsOnSale = clothbaseProduct.originalPrice && clothbaseOriginalPriceNumeric > clothbasePriceNumeric;
        
        return {
          success: !clothbaseProduct.error,
          product: {
            // Keep all original fields
            ...clothbaseProduct,
            
            // Database schema fields
            product_name: clothbaseProduct.name,
            brand: clothbaseProduct.brand || 'Unknown',
            original_price: clothbaseOriginalPriceNumeric,
            sale_price: clothbasePriceNumeric,
            is_on_sale: clothbaseIsOnSale,
            discount_percentage: clothbaseIsOnSale ? 
              Math.round((1 - clothbasePriceNumeric / clothbaseOriginalPriceNumeric) * 100) : null,
            sale_badge: clothbaseIsOnSale ? 'SALE' : null,
            image_urls: clothbaseProduct.images || [],
            vendor_url: clothbaseProduct.url || url,
            color: clothbaseProduct.colors?.length > 0 ? clothbaseProduct.colors[0] : '',
            colors: clothbaseProduct.colors || [],
            sizes: clothbaseProduct.sizes || [],
            category: detectCategory(
              clothbaseProduct.name || '',
              clothbaseProduct.description || '',
              clothbaseProduct.brand || '',
              null
            ),
            material: clothbaseProduct.material || '',
            description: clothbaseProduct.description || '',
            condition: clothbaseProduct.condition || '',
            measurements: clothbaseProduct.measurements || {},
            in_stock: clothbaseProduct.inStock !== false,
            retailer: clothbaseProduct.retailer || 'Clothbase',
            
            // Legacy fields
            name: clothbaseProduct.name,
            price: clothbasePriceNumeric,
            images: clothbaseProduct.images || [],
            originalPrice: clothbaseOriginalPriceNumeric,
            isOnSale: clothbaseIsOnSale,
            discountPercentage: clothbaseIsOnSale ? 
              Math.round((1 - clothbasePriceNumeric / clothbaseOriginalPriceNumeric) * 100) : null,
            saleBadge: clothbaseIsOnSale ? 'SALE' : null
          }
        };
      
      case 'massimodutti':
        console.log('👔 Using Massimo Dutti scraper');
        const mdProduct = await scrapeMassimoDutti(url);
        
        // Extract price number
        const mdPriceNumeric = typeof mdProduct.price === 'number' ? mdProduct.price : 0;
        const mdOriginalPriceNumeric = mdProduct.originalPrice || mdPriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...mdProduct,
            
            // Database schema fields
            product_name: mdProduct.name,
            brand: mdProduct.brand || 'Massimo Dutti',
            original_price: mdOriginalPriceNumeric,
            sale_price: mdPriceNumeric,
            is_on_sale: mdProduct.isOnSale || false,
            discount_percentage: mdProduct.isOnSale && mdOriginalPriceNumeric > mdPriceNumeric ? 
              Math.round((1 - mdPriceNumeric / mdOriginalPriceNumeric) * 100) : null,
            sale_badge: mdProduct.isOnSale ? 'SALE' : null,
            image_urls: mdProduct.images || [],
            vendor_url: mdProduct.url || url,
            color: mdProduct.color || '',
            category: detectCategory(
              mdProduct.name || '',
              mdProduct.description || '',
              mdProduct.brand || 'Massimo Dutti',
              mdProduct.category
            ),
            material: mdProduct.materials?.join(', ') || '',
            description: mdProduct.description || '',
            sizes: mdProduct.sizes || [],
            in_stock: mdProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: mdProduct.name,
            price: mdPriceNumeric,
            images: mdProduct.images || [],
            originalPrice: mdOriginalPriceNumeric,
            isOnSale: mdProduct.isOnSale || false,
            discountPercentage: mdProduct.isOnSale && mdOriginalPriceNumeric > mdPriceNumeric ? 
              Math.round((1 - mdPriceNumeric / mdOriginalPriceNumeric) * 100) : null,
            saleBadge: mdProduct.isOnSale ? 'SALE' : null
          }
        };
      
      case 'camperlab':
        console.log('👟 Using Camperlab scraper');
        const camperlabProduct = await scrapeCamperlab(url);
        
        // Handle both listing page and product page responses
        if (camperlabProduct.products) {
          // Listing page response
          return {
            success: true,
            products: camperlabProduct.products,
            totalProducts: camperlabProduct.totalProducts
          };
        }
        
        // Product page response - extract price number
        const camperlabPriceNumeric = typeof camperlabProduct.price === 'string' ? 
          parseFloat(camperlabProduct.price.replace(/[^0-9.]/g, '')) : 
          (typeof camperlabProduct.price === 'number' ? camperlabProduct.price : 0);
        
        const camperlabOriginalPriceNumeric = camperlabProduct.originalPrice ? 
          parseFloat(camperlabProduct.originalPrice.replace(/[^0-9.]/g, '')) : 
          camperlabPriceNumeric;
        
        const camperlabIsOnSale = camperlabOriginalPriceNumeric > camperlabPriceNumeric;
        
        return {
          success: true,
          product: {
            // Keep all original fields
            ...camperlabProduct,
            
            // Database schema fields
            product_name: camperlabProduct.name,
            brand: camperlabProduct.brand || 'Camperlab',
            original_price: camperlabOriginalPriceNumeric,
            sale_price: camperlabPriceNumeric,
            is_on_sale: camperlabIsOnSale,
            discount_percentage: camperlabIsOnSale && camperlabOriginalPriceNumeric > 0 ? 
              Math.round((1 - camperlabPriceNumeric / camperlabOriginalPriceNumeric) * 100) : null,
            sale_badge: camperlabIsOnSale ? 'SALE' : null,
            image_urls: camperlabProduct.images || [],
            vendor_url: camperlabProduct.url || url,
            color: camperlabProduct.colors?.join(', ') || '',
            category: detectCategory(
              camperlabProduct.name || '',
              camperlabProduct.description || '',
              camperlabProduct.brand || 'Camperlab',
              camperlabProduct.category || 'Shoes'
            ),
            material: '',
            description: camperlabProduct.description || '',
            sizes: camperlabProduct.sizes || [],
            sku: camperlabProduct.sku || '',
            in_stock: camperlabProduct.inStock !== false,
            
            // Legacy fields for backward compatibility
            name: camperlabProduct.name,
            price: camperlabPriceNumeric,
            images: camperlabProduct.images || [],
            originalPrice: camperlabOriginalPriceNumeric,
            isOnSale: camperlabIsOnSale,
            discountPercentage: camperlabIsOnSale && camperlabOriginalPriceNumeric > 0 ? 
              Math.round((1 - camperlabPriceNumeric / camperlabOriginalPriceNumeric) * 100) : null,
            saleBadge: camperlabIsOnSale ? 'SALE' : null
          }
        };
      
      case 'fwrd':
        console.log('🛍️ Using FWRD scraper');
        const fwrdResult = await scrapeFWRD(url);

        if (fwrdResult.success && fwrdResult.product) {
          const fwrdProduct = fwrdResult.product;

          // Extract price number
          const fwrdPriceNumeric = typeof fwrdProduct.price === 'string' ?
            parseFloat(fwrdProduct.price.replace(/[^0-9.]/g, '')) :
            (typeof fwrdProduct.price === 'number' ? fwrdProduct.price : 0);

          const fwrdOriginalPriceNumeric = fwrdProduct.originalPrice ?
            parseFloat(fwrdProduct.originalPrice.replace(/[^0-9.]/g, '')) :
            fwrdPriceNumeric;

          const fwrdIsOnSale = fwrdOriginalPriceNumeric > fwrdPriceNumeric;

          return {
            success: true,
            product: {
              // Keep all original fields
              ...fwrdProduct,

              // Database schema fields
              product_name: fwrdProduct.name,
              brand: fwrdProduct.brand || 'FWRD',
              original_price: fwrdOriginalPriceNumeric,
              sale_price: fwrdPriceNumeric,
              is_on_sale: fwrdIsOnSale,
              discount_percentage: fwrdIsOnSale && fwrdOriginalPriceNumeric > 0 ?
                Math.round((1 - fwrdPriceNumeric / fwrdOriginalPriceNumeric) * 100) : null,
              sale_badge: fwrdIsOnSale ? 'SALE' : null,
              image_urls: fwrdProduct.images || [],
              vendor_url: fwrdProduct.url || url,
              color: fwrdProduct.colors?.join(', ') || '',
              colors: fwrdProduct.colors || [],
              sizes: fwrdProduct.sizes || [],
              category: detectCategory(
                fwrdProduct.name || '',
                fwrdProduct.description || '',
                fwrdProduct.brand || 'FWRD',
                fwrdProduct.category
              ),
              material: '',
              description: fwrdProduct.description || '',
              sku: fwrdProduct.sku || '',
              in_stock: fwrdProduct.inStock !== false,

              // Legacy fields for backward compatibility
              name: fwrdProduct.name,
              price: fwrdPriceNumeric,
              images: fwrdProduct.images || [],
              originalPrice: fwrdOriginalPriceNumeric,
              isOnSale: fwrdIsOnSale,
              discountPercentage: fwrdIsOnSale && fwrdOriginalPriceNumeric > 0 ?
                Math.round((1 - fwrdPriceNumeric / fwrdOriginalPriceNumeric) * 100) : null,
              saleBadge: fwrdIsOnSale ? 'SALE' : null
            }
          };
        }

        return fwrdResult;

      case 'miumiu':
        console.log('👜 Using Miu Miu scraper');
        const miuMiuResult = await scrapeMiuMiu(url);

        // Check if Puppeteer is needed
        if (miuMiuResult.needsPuppeteer) {
          console.log('🔄 Miu Miu requires Puppeteer, using enhanced scraper...');
          const { scrapeMiuMiuWithPuppeteer } = require('./miumiu-puppeteer');
          const puppeteerResult = await scrapeMiuMiuWithPuppeteer(url);

          if (puppeteerResult.success && puppeteerResult.product) {
            const miuMiuProduct = puppeteerResult.product;

            // Extract price number
            const miuMiuPriceNumeric = typeof miuMiuProduct.price === 'string' ?
              parseFloat(miuMiuProduct.price.replace(/[^0-9.]/g, '')) :
              (typeof miuMiuProduct.price === 'number' ? miuMiuProduct.price : 0);

            const miuMiuOriginalPriceNumeric = miuMiuProduct.originalPrice ?
              parseFloat(miuMiuProduct.originalPrice.replace(/[^0-9.]/g, '')) :
              miuMiuPriceNumeric;

            const miuMiuIsOnSale = miuMiuOriginalPriceNumeric > miuMiuPriceNumeric;

            return {
              success: true,
              product: {
                ...miuMiuProduct,
                product_name: miuMiuProduct.name,
                brand: miuMiuProduct.brand || 'Miu Miu',
                original_price: miuMiuOriginalPriceNumeric,
                sale_price: miuMiuPriceNumeric,
                is_on_sale: miuMiuIsOnSale,
                discount_percentage: miuMiuIsOnSale && miuMiuOriginalPriceNumeric > 0 ?
                  Math.round((1 - miuMiuPriceNumeric / miuMiuOriginalPriceNumeric) * 100) : null,
                sale_badge: miuMiuIsOnSale ? 'SALE' : null,
                image_urls: miuMiuProduct.images || [],
                vendor_url: miuMiuProduct.url || url,
                color: miuMiuProduct.colors?.join(', ') || '',
                colors: miuMiuProduct.colors || [],
                sizes: miuMiuProduct.sizes || [],
                category: detectCategory(
                  miuMiuProduct.name || '',
                  miuMiuProduct.description || '',
                  miuMiuProduct.brand || 'Miu Miu',
                  miuMiuProduct.category
                ),
                material: miuMiuProduct.material || '',
                description: miuMiuProduct.description || '',
                sku: miuMiuProduct.sku || '',
                in_stock: miuMiuProduct.inStock !== false,
                name: miuMiuProduct.name,
                price: miuMiuPriceNumeric,
                images: miuMiuProduct.images || [],
                originalPrice: miuMiuOriginalPriceNumeric,
                isOnSale: miuMiuIsOnSale,
                discountPercentage: miuMiuIsOnSale && miuMiuOriginalPriceNumeric > 0 ?
                  Math.round((1 - miuMiuPriceNumeric / miuMiuOriginalPriceNumeric) * 100) : null,
                saleBadge: miuMiuIsOnSale ? 'SALE' : null
              }
            };
          }

          return puppeteerResult;
        }

        if (miuMiuResult.success && miuMiuResult.product) {
          const miuMiuProduct = miuMiuResult.product;

          // Extract price number
          const miuMiuPriceNumeric = typeof miuMiuProduct.price === 'string' ?
            parseFloat(miuMiuProduct.price.replace(/[^0-9.]/g, '')) :
            (typeof miuMiuProduct.price === 'number' ? miuMiuProduct.price : 0);

          const miuMiuOriginalPriceNumeric = miuMiuProduct.originalPrice ?
            parseFloat(miuMiuProduct.originalPrice.replace(/[^0-9.]/g, '')) :
            miuMiuPriceNumeric;

          const miuMiuIsOnSale = miuMiuOriginalPriceNumeric > miuMiuPriceNumeric;

          return {
            success: true,
            product: {
              // Keep all original fields
              ...miuMiuProduct,

              // Database schema fields
              product_name: miuMiuProduct.name,
              brand: miuMiuProduct.brand || 'Miu Miu',
              original_price: miuMiuOriginalPriceNumeric,
              sale_price: miuMiuPriceNumeric,
              is_on_sale: miuMiuIsOnSale,
              discount_percentage: miuMiuIsOnSale && miuMiuOriginalPriceNumeric > 0 ?
                Math.round((1 - miuMiuPriceNumeric / miuMiuOriginalPriceNumeric) * 100) : null,
              sale_badge: miuMiuIsOnSale ? 'SALE' : null,
              image_urls: miuMiuProduct.images || [],
              vendor_url: miuMiuProduct.url || url,
              color: miuMiuProduct.colors?.join(', ') || '',
              colors: miuMiuProduct.colors || [],
              sizes: miuMiuProduct.sizes || [],
              category: detectCategory(
                miuMiuProduct.name || '',
                miuMiuProduct.description || '',
                miuMiuProduct.brand || 'Miu Miu',
                miuMiuProduct.category
              ),
              material: miuMiuProduct.material || '',
              description: miuMiuProduct.description || '',
              sku: miuMiuProduct.sku || '',
              in_stock: miuMiuProduct.inStock !== false,

              // Legacy fields for backward compatibility
              name: miuMiuProduct.name,
              price: miuMiuPriceNumeric,
              images: miuMiuProduct.images || [],
              originalPrice: miuMiuOriginalPriceNumeric,
              isOnSale: miuMiuIsOnSale,
              discountPercentage: miuMiuIsOnSale && miuMiuOriginalPriceNumeric > 0 ?
                Math.round((1 - miuMiuPriceNumeric / miuMiuOriginalPriceNumeric) * 100) : null,
              saleBadge: miuMiuIsOnSale ? 'SALE' : null
            }
          };
        }

        return miuMiuResult;

      case 'chiclara':
        console.log('🛍️ Using Chiclara scraper');
        const chiclaraResult = await scrapeChiclara(url);

        if (chiclaraResult.success && chiclaraResult.product) {
          const chiclaraProduct = chiclaraResult.product;

          // Extract price number
          const chiclaraPriceNumeric = typeof chiclaraProduct.sale_price === 'number' ?
            chiclaraProduct.sale_price : 0;

          const chiclaraOriginalPriceNumeric = chiclaraProduct.original_price ?
            chiclaraProduct.original_price : chiclaraPriceNumeric;

          const chiclaraIsOnSale = chiclaraOriginalPriceNumeric > chiclaraPriceNumeric;

          return {
            success: true,
            product: {
              // Primary fields
              product_name: chiclaraProduct.product_name,
              brand: chiclaraProduct.brand || 'CHICLARA',
              sale_price: chiclaraPriceNumeric,
              original_price: chiclaraOriginalPriceNumeric,
              currency: chiclaraProduct.currency || 'USD',
              product_url: url,
              image_urls: chiclaraProduct.image_urls || [],
              sizes: chiclaraProduct.sizes || [],
              colors: chiclaraProduct.colors || [],
              category: detectCategory(
                chiclaraProduct.product_name,
                chiclaraProduct.description || '',
                chiclaraProduct.brand || 'CHICLARA',
                chiclaraProduct.category
              ),
              material: chiclaraProduct.material || '',
              description: chiclaraProduct.description || '',
              sku: chiclaraProduct.sku || '',
              in_stock: chiclaraProduct.in_stock !== false,

              // Legacy fields for backward compatibility
              name: chiclaraProduct.product_name,
              price: chiclaraPriceNumeric,
              images: chiclaraProduct.image_urls || [],
              originalPrice: chiclaraOriginalPriceNumeric,
              isOnSale: chiclaraIsOnSale,
              discountPercentage: chiclaraIsOnSale && chiclaraOriginalPriceNumeric > 0 ?
                Math.round((1 - chiclaraPriceNumeric / chiclaraOriginalPriceNumeric) * 100) : null,
              saleBadge: chiclaraIsOnSale ? 'SALE' : null
            }
          };
        }

        return chiclaraResult;

      case 'wconcept':
        console.log('🛍️ Using W Concept scraper');
        const wconceptProduct = await scrapeWConcept(url);

        // Extract price (already numeric from scraper)
        const wconceptPriceNumeric = wconceptProduct.price || 0;
        const wconceptOriginalPriceNumeric = wconceptProduct.originalPrice || wconceptPriceNumeric;

        return {
          success: true,
          product: {
            // Keep all original fields
            ...wconceptProduct,

            // Database schema fields
            product_name: wconceptProduct.name,
            brand: wconceptProduct.brand || 'W Concept',
            original_price: wconceptOriginalPriceNumeric,
            sale_price: wconceptPriceNumeric,
            is_on_sale: wconceptProduct.isOnSale || false,
            discount_percentage: wconceptProduct.isOnSale && wconceptOriginalPriceNumeric > wconceptPriceNumeric ?
              Math.round((1 - wconceptPriceNumeric / wconceptOriginalPriceNumeric) * 100) : null,
            sale_badge: wconceptProduct.isOnSale ? 'SALE' : null,
            image_urls: wconceptProduct.images || [],
            vendor_url: wconceptProduct.url || url,
            color: wconceptProduct.color || '',
            colors: [],
            sizes: wconceptProduct.sizes || [],
            category: detectCategory(
              wconceptProduct.name || '',
              wconceptProduct.description || '',
              wconceptProduct.brand || 'W Concept',
              wconceptProduct.category
            ),
            material: '',
            description: wconceptProduct.description || '',
            sku: wconceptProduct.sku || '',
            in_stock: wconceptProduct.inStock !== false,
            product_id: wconceptProduct.productId || '',

            // Legacy fields for backward compatibility
            name: wconceptProduct.name,
            price: wconceptPriceNumeric,
            images: wconceptProduct.images || [],
            originalPrice: wconceptOriginalPriceNumeric,
            isOnSale: wconceptProduct.isOnSale || false,
            discountPercentage: wconceptProduct.isOnSale && wconceptOriginalPriceNumeric > wconceptPriceNumeric ?
              Math.round((1 - wconceptPriceNumeric / wconceptOriginalPriceNumeric) * 100) : null,
            saleBadge: wconceptProduct.isOnSale ? 'SALE' : null
          }
        };

      case 'boden':
        console.log('👗 Using Boden scraper');
        const bodenProduct = await scrapeBoden(url);

        // Extract price (already numeric from scraper)
        const bodenPriceNumeric = bodenProduct.price || 0;
        const bodenOriginalPriceNumeric = bodenProduct.originalPrice || bodenPriceNumeric;

        return {
          success: true,
          product: {
            // Keep all original fields
            ...bodenProduct,

            // Database schema fields
            product_name: bodenProduct.name,
            brand: bodenProduct.brand || 'Boden',
            original_price: bodenOriginalPriceNumeric,
            sale_price: bodenPriceNumeric,
            is_on_sale: bodenProduct.isOnSale || false,
            discount_percentage: bodenProduct.isOnSale && bodenOriginalPriceNumeric > bodenPriceNumeric ?
              Math.round((1 - bodenPriceNumeric / bodenOriginalPriceNumeric) * 100) : null,
            sale_badge: bodenProduct.isOnSale ? 'SALE' : null,
            image_urls: bodenProduct.images || [],
            vendor_url: bodenProduct.url || url,
            color: bodenProduct.color || '',
            colors: bodenProduct.colors || [],
            sizes: bodenProduct.sizes || [],
            category: detectCategory(
              bodenProduct.name || '',
              bodenProduct.description || '',
              bodenProduct.brand || 'Boden',
              bodenProduct.category
            ),
            material: '',
            description: bodenProduct.description || '',
            sku: bodenProduct.sku || '',
            in_stock: bodenProduct.inStock !== false,

            // Legacy fields for backward compatibility
            name: bodenProduct.name,
            price: bodenPriceNumeric,
            images: bodenProduct.images || [],
            originalPrice: bodenOriginalPriceNumeric,
            isOnSale: bodenProduct.isOnSale || false,
            discountPercentage: bodenProduct.isOnSale && bodenOriginalPriceNumeric > bodenPriceNumeric ?
              Math.round((1 - bodenPriceNumeric / bodenOriginalPriceNumeric) * 100) : null,
            saleBadge: bodenProduct.isOnSale ? 'SALE' : null
          }
        };

      // Note: Arket removed - requires JS rendering, falls through to Universal Parser

      case 'unijay':
        console.log('🛍️ Using Unijay scraper');
        const unijayProduct = await scrapeUnijay(url);

        // Extract price number (handle KRW prices)
        let unijayPriceNumeric = 0;
        if (unijayProduct.price) {
          unijayPriceNumeric = typeof unijayProduct.price === 'number' ?
            unijayProduct.price : parseFloat(unijayProduct.price) || 0;
        }

        let unijayOriginalPriceNumeric = unijayPriceNumeric;
        if (unijayProduct.originalPrice) {
          unijayOriginalPriceNumeric = typeof unijayProduct.originalPrice === 'number' ?
            unijayProduct.originalPrice : parseFloat(unijayProduct.originalPrice) || unijayPriceNumeric;
        }

        const unijayIsOnSale = unijayProduct.originalPrice && unijayOriginalPriceNumeric > unijayPriceNumeric;

        return {
          success: !unijayProduct.error,
          product: {
            // Keep all original fields
            ...unijayProduct,

            // Database schema fields
            product_name: unijayProduct.name,
            brand: unijayProduct.brand || 'Unijay',
            original_price: unijayOriginalPriceNumeric,
            sale_price: unijayPriceNumeric,
            is_on_sale: unijayIsOnSale,
            discount_percentage: unijayIsOnSale ?
              Math.round((1 - unijayPriceNumeric / unijayOriginalPriceNumeric) * 100) : null,
            sale_badge: unijayIsOnSale ? 'SALE' : null,
            image_urls: unijayProduct.images || [],
            vendor_url: unijayProduct.url || url,
            colors: unijayProduct.colors || [],
            sizes: unijayProduct.sizes || [],
            category: detectCategory(
              unijayProduct.name || '',
              unijayProduct.description || '',
              unijayProduct.brand || '',
              null
            ),
            description: unijayProduct.description || '',
            in_stock: unijayProduct.inStock !== false,
            variants: unijayProduct.variants || [],
            currency: unijayProduct.currency || 'KRW',

            // Legacy fields
            name: unijayProduct.name,
            price: unijayPriceNumeric,
            images: unijayProduct.images || [],
            originalPrice: unijayOriginalPriceNumeric,
            isOnSale: unijayIsOnSale,
            discountPercentage: unijayIsOnSale ?
              Math.round((1 - unijayPriceNumeric / unijayOriginalPriceNumeric) * 100) : null,
            saleBadge: unijayIsOnSale ? 'SALE' : null
          }
        };

      case 'gallerydept':
        console.log('🎨 Using Gallery Dept scraper');
        const galleryDeptResult = await scrapeGalleryDept(url);

        if (galleryDeptResult.success && galleryDeptResult.product) {
          const gdProduct = galleryDeptResult.product;

          // Extract price numbers
          const gdPriceNumeric = typeof gdProduct.sale_price === 'number' ?
            gdProduct.sale_price : 0;

          const gdOriginalPriceNumeric = gdProduct.original_price || gdPriceNumeric;

          const gdIsOnSale = gdOriginalPriceNumeric > gdPriceNumeric;

          return {
            success: true,
            product: {
              // Primary fields
              product_name: gdProduct.product_name,
              brand: gdProduct.brand || 'GALLERY DEPT',
              sale_price: gdPriceNumeric,
              original_price: gdOriginalPriceNumeric,
              currency: gdProduct.currency || 'USD',
              product_url: url,
              image_urls: gdProduct.image_urls || [],
              sizes: gdProduct.sizes || [],
              colors: gdProduct.colors || [],
              category: detectCategory(
                gdProduct.product_name,
                gdProduct.description || '',
                gdProduct.brand || 'GALLERY DEPT',
                gdProduct.category
              ),
              material: gdProduct.material || '',
              description: gdProduct.description || '',
              sku: gdProduct.sku || '',
              in_stock: gdProduct.in_stock !== false,

              // Legacy fields for backward compatibility
              name: gdProduct.product_name,
              price: gdPriceNumeric,
              images: gdProduct.image_urls || [],
              originalPrice: gdOriginalPriceNumeric,
              isOnSale: gdIsOnSale,
              discountPercentage: gdIsOnSale && gdOriginalPriceNumeric > 0 ?
                Math.round((1 - gdPriceNumeric / gdOriginalPriceNumeric) * 100) : null,
              saleBadge: gdIsOnSale ? 'SALE' : null
            }
          };
        }

        return galleryDeptResult;

      case 'farfetch':
        console.log('🛍️ Using Farfetch scraper');
        const farfetchProduct = await scrapeFarfetch(url);

        // Handle potential Puppeteer fallback requirement
        if (farfetchProduct.needsPuppeteer) {
          console.log('⚠️ Farfetch requires Puppeteer, but generic scraper not available');
          // return await scrapeGeneric(url); // TODO: Implement generic scraper
          return {
            success: false,
            error: 'Generic scraper not implemented',
            product: null
          };
        }

        return farfetchProduct;
      
      default:
        console.log('❌ No specific scraper in switch statement');

        // STEP 1: Try auto-discovered scraper from registry
        const autoDiscoveredScraper = getScraperFunction(site);
        if (autoDiscoveredScraper) {
          console.log(`✨ Using auto-discovered scraper for: ${site}`);
          try {
            const autoResult = await autoDiscoveredScraper(url);
            return {
              success: !autoResult.error,
              product: {
                ...autoResult,
                product_name: autoResult.name || autoResult.product_name,
                brand: autoResult.brand || 'Unknown',
                original_price: autoResult.originalPrice || autoResult.price || 0,
                sale_price: autoResult.price || 0,
                image_urls: autoResult.images || [],
                vendor_url: url,
                platform: site
              }
            };
          } catch (autoError) {
            console.log(`⚠️ Auto-discovered scraper failed: ${autoError.message}`);
            // Continue to fallback options
          }
        }

        // STEP 2: Try to detect if it's a Shopify store dynamically
        console.log('🔍 Checking if site is Shopify...');
        const mightBeShopify = await isShopifyStore(url);
        
        if (mightBeShopify) {
          console.log('✅ Detected as Shopify store, using Shopify scraper');
          const shopifyProduct = await scrapeShopify(url);
          
          // Extract price number from string or number
          let shopifyPriceNumeric = 0;
          if (shopifyProduct.price) {
            if (typeof shopifyProduct.price === 'number') {
              shopifyPriceNumeric = shopifyProduct.price;
            } else {
              const priceMatch = String(shopifyProduct.price).match(/[\d,]+\.?\d*/);
              shopifyPriceNumeric = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
            }
          }

          let shopifyOriginalPriceNumeric = shopifyPriceNumeric;
          if (shopifyProduct.originalPrice) {
            if (typeof shopifyProduct.originalPrice === 'number') {
              shopifyOriginalPriceNumeric = shopifyProduct.originalPrice;
            } else {
              const originalMatch = String(shopifyProduct.originalPrice).match(/[\d,]+\.?\d*/);
              shopifyOriginalPriceNumeric = originalMatch ? parseFloat(originalMatch[0].replace(',', '')) : shopifyPriceNumeric;
            }
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
        
        // STEP 3: Final fallback - Try Universal Parser
        console.log('🔄 No specific scraper found, trying Universal Parser as fallback...');
        if (universalParser) {
          try {
            const universalResult = await tryUniversalParser(url);
            if (universalResult && universalResult.success) {
              console.log('✅ Universal Parser succeeded as fallback');

              // ZARA POST-PROCESSOR: Extract all product images and price if this is a Zara URL
              if (url.includes('zara.com') && universalResult.product) {
                const productId = extractZaraProductId(url);
                if (productId) {
                  console.log('🎯 Applying Zara post-processor...');

                  // Get the HTML from the universal parser result
                  const html = universalResult.product.html || universalResult.product._rawHtml || '';

                  if (html) {
                    // Extract images
                    const zaraImages = extractZaraImages(html, productId);
                    if (zaraImages.length > 0) {
                      console.log(`✨ Extracted ${zaraImages.length} Zara product images`);
                      // Replace the single image with all product images
                      universalResult.product.images = zaraImages;
                      universalResult.product.image_urls = zaraImages;
                    }

                    // Extract price
                    const zaraPrice = extractZaraPrice(html);
                    if (zaraPrice) {
                      // Set all price fields so normalization picks it up
                      universalResult.product.product_price = zaraPrice;
                      universalResult.product.price = zaraPrice;
                      universalResult.product.original_price = zaraPrice;
                      universalResult.product.sale_price = zaraPrice;
                    }
                  } else {
                    console.log('⚠️ No HTML available for Zara post-processor');
                  }
                }
              }

              return universalResult;
            }
            console.log('⚠️ Universal Parser returned low confidence or failed');
          } catch (universalError) {
            console.log(`⚠️ Universal Parser error: ${universalError.message}`);
          }
        }

        // STEP 4: All fallbacks exhausted
        console.log('❌ All scraping methods exhausted for this site');
        return {
          success: false,
          error: 'No scraper available for this site and all fallbacks failed',
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
