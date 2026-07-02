/**
 * SINGLE SOURCE OF TRUTH for per-site routing.
 *
 * Previously this was split across three drifting places:
 *   - SITE_REGISTRY            (server.js)            → timeout + coarse flag
 *   - detectSite() if-cascade  (scrapers/index.js)    → which scraper to run
 *   - FIRECRAWL_REQUIRED_SITES (scrapers/index.js)    → firecrawl-first sites
 * They disagreed in practice (e.g. SSENSE: registry said "dedicated" while
 * detectSite routed it to "firecrawl"). Everything routing-related now lives
 * here so it can't drift.
 *
 * NOTE: this file does NOT cover the universal parser's fetch-strategy sets
 * (requiresBrowser / blocksDirectFetch in universal-parser-v3.js) — those decide
 * HOW the universal parser fetches a page, not WHICH scraper handles a site, and
 * are intentionally left in place.
 *
 * Each entry: match (hostname substring) → routing.
 *   scraper:  the detectSite() route key (a switch case in scrapers/index.js).
 *             'firecrawl' means route to Firecrawl first.
 *             null means "no dedicated route" — fall through to Shopify/universal.
 *   timeout:  request timeout in ms (used by server.js getSiteConfig).
 *   requiresFirecrawl: true → route to 'firecrawl' ONLY when a Firecrawl parser
 *             is configured; otherwise use `scraper` (or fall through).
 *
 * ORDER MATTERS: matching is first-substring-wins, so more specific hosts must
 * come before less specific ones (e.g. 'saksfifthavenue.' before 'saks.',
 * 'go.shopmy.us' before 'shopmy.us').
 */

// Firecrawl-first sites: strong bot protection / enterprise WAF where the cheap
// scrapers fail. Routed to 'firecrawl' when a Firecrawl parser is available.
const FIRECRAWL_TIMEOUT = 60000;
const DEFAULT_TIMEOUT = 30000;

// The ordered routing table. `scraper` is the detectSite route key.
const SITE_ROUTES = [
  // --- SSENSE: Firecrawl-first (Cloudflare), else its own tiered chain ---
  { match: 'ssense.com', scraper: 'ssense', requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },

  // --- Dedicated: JS-rendered prices / specific handling ---
  { match: 'ourlegacy.com', scraper: 'ourlegacy', timeout: DEFAULT_TIMEOUT },

  // --- Firecrawl-required sites (enterprise bot detection) ---
  // requiresFirecrawl: with a Firecrawl parser → 'firecrawl'; without one → the
  // `scraper` fallback (a dedicated route where one exists, else null → universal).
  { match: 'rei.com', scraper: null, requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'ralphlauren.', scraper: 'ralphlauren', requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'net-a-porter.', scraper: 'netaporter', requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'mrporter.com', scraper: null, requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'aritzia.com', scraper: null, requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'chanel.com', scraper: null, requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'mammut.com', scraper: null, requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  // etsy & kolonmall are firecrawl-required AND have dedicated fallbacks
  { match: 'etsy.', scraper: 'etsy', requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },
  { match: 'kolonmall.', scraper: 'kolonmall', requiresFirecrawl: true, timeout: FIRECRAWL_TIMEOUT },

  // --- Dedicated scrapers ---
  { match: 'amazon.', scraper: 'amazon', timeout: DEFAULT_TIMEOUT },
  { match: 'farfetch.', scraper: 'farfetch', timeout: DEFAULT_TIMEOUT },
  { match: 'garmentory.', scraper: 'garmentory', timeout: DEFAULT_TIMEOUT },
  { match: 'ebay.', scraper: 'ebay', timeout: DEFAULT_TIMEOUT },
  { match: 'cos.com', scraper: 'cos', timeout: DEFAULT_TIMEOUT },
  { match: 'sezane.', scraper: 'sezane', timeout: DEFAULT_TIMEOUT },
  { match: 'nordstrom.', scraper: 'nordstrom', timeout: DEFAULT_TIMEOUT },
  { match: 'saksfifthavenue.', scraper: 'saksfifthavenue', timeout: DEFAULT_TIMEOUT },
  { match: 'saks.', scraper: 'saksfifthavenue', timeout: DEFAULT_TIMEOUT },
  { match: 'poshmark.', scraper: 'poshmark', timeout: DEFAULT_TIMEOUT },
  { match: 'shopstyle.', scraper: 'shopstyle', timeout: DEFAULT_TIMEOUT },

  // --- Redirect resolvers (affiliate / shorteners) ---
  { match: 'go.shopmy.us', scraper: 'redirect', timeout: DEFAULT_TIMEOUT },
  { match: 'shopmy.us', scraper: 'redirect', timeout: DEFAULT_TIMEOUT },
  { match: 'bit.ly', scraper: 'redirect', timeout: DEFAULT_TIMEOUT },
  { match: 'shareasale.com', scraper: 'redirect', timeout: DEFAULT_TIMEOUT },
  { match: 'click.linksynergy.com', scraper: 'redirect', timeout: DEFAULT_TIMEOUT },

  { match: 'instagram.com', scraper: 'instagram', timeout: DEFAULT_TIMEOUT },

  // --- Sites deliberately routed to universal/Shopify (scraper: null) ---
  // Their dedicated scrapers were retired (couldn't get images/prices); they
  // fall through to Shopify detection → universal parser.
  { match: 'zara.com', scraper: null, timeout: DEFAULT_TIMEOUT },
  { match: 'freepeople.', scraper: null, timeout: DEFAULT_TIMEOUT },
  { match: 'arket.', scraper: null, timeout: DEFAULT_TIMEOUT },

  { match: 'urbanoutfitters.', scraper: 'urbanoutfitters', timeout: DEFAULT_TIMEOUT },
  { match: 'revolve.', scraper: 'revolve', timeout: DEFAULT_TIMEOUT },
  { match: 'asos.', scraper: 'asos', timeout: DEFAULT_TIMEOUT },
  { match: 'reformation.', scraper: 'reformation', timeout: DEFAULT_TIMEOUT },
  { match: 'everlane.', scraper: 'everlane', timeout: DEFAULT_TIMEOUT },
  { match: 'anthropologie.', scraper: 'anthropologie', timeout: DEFAULT_TIMEOUT },
  { match: 'madewell.', scraper: 'madewell', timeout: DEFAULT_TIMEOUT },
  { match: 'lululemon.', scraper: 'lululemon', timeout: DEFAULT_TIMEOUT },
  { match: 'stories.', scraper: 'stories', timeout: DEFAULT_TIMEOUT },
  { match: 'mytheresa.', scraper: 'mytheresa', timeout: DEFAULT_TIMEOUT },
  { match: 'clothbase.', scraper: 'clothbase', timeout: DEFAULT_TIMEOUT },
  { match: 'arcteryx.', scraper: 'arcteryx', timeout: DEFAULT_TIMEOUT },
  { match: 'songforthemute.', scraper: 'songforthemute', timeout: DEFAULT_TIMEOUT },
  { match: 'massimodutti.', scraper: 'massimodutti', timeout: 60000 },
  { match: 'camperlab.', scraper: 'camperlab', timeout: DEFAULT_TIMEOUT },
  { match: 'fwrd.', scraper: 'fwrd', timeout: 60000 },
  { match: 'miumiu.', scraper: 'miumiu', timeout: DEFAULT_TIMEOUT },
  { match: 'chiclara.', scraper: 'chiclara', timeout: DEFAULT_TIMEOUT },
  { match: 'gallerydept.', scraper: 'gallerydept', timeout: DEFAULT_TIMEOUT },
  { match: 'unijay.', scraper: 'unijay', timeout: DEFAULT_TIMEOUT },
  { match: 'boden.', scraper: 'boden', timeout: DEFAULT_TIMEOUT },
  { match: 'wconcept.', scraper: 'wconcept', timeout: 60000 },

  // --- Known Shopify domains (force the Shopify scraper) ---
  ...[
    'chavastudio.com', 'phoebephilo.com', 'stoffa.co', 'soeur.fr',
    'shopattersee.com', 'babaa.es', 'nu-swim.com', 'shopneighbour.com',
    'shop-vestige.com', 'rachelcomey.com', 'oldstonetrade.com', 'flore-flore.com',
    'emreitz.com', 'tibi.com', 'fm669.us', 'jamesstreetco.com', 'gimaguas.com',
    'footindustry.com', 'shopcatandkate.com', 'wearing-esme.com',
  ].map((match) => ({ match, scraper: 'shopify', timeout: DEFAULT_TIMEOUT })),
];

/**
 * Find the routing entry for a URL or hostname (first substring match wins).
 * Returns null when no site matches.
 */
function findRoute(urlOrHostname) {
  let hostname;
  try {
    hostname = String(urlOrHostname).includes('://')
      ? new URL(urlOrHostname).hostname.toLowerCase()
      : String(urlOrHostname || '').toLowerCase();
  } catch {
    hostname = String(urlOrHostname || '').toLowerCase();
  }
  return SITE_ROUTES.find((r) => hostname.includes(r.match)) || null;
}

module.exports = { SITE_ROUTES, findRoute, DEFAULT_TIMEOUT };
