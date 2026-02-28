/**
 * crawl-agent.js
 * Orchestrates the full pipeline:
 *   discover URLs → scrape each → save to Supabase + local disk
 *
 * Works as both a standalone script and an imported module.
 */

const { LinkDiscoverer } = require('./link-discoverer');
const LocalStorage = require('./local-storage');

// Scraper loader — avoids the duplicate-declaration bug in scrapers/index.js
// by loading individual scrapers on demand.
const { scrapeShopify, isShopifyStore } = require('../scrapers/shopify');

function stripVariant(url) {
  // Remove ?variant=... so we don't scrape the same product N times
  try {
    const u = new URL(url);
    u.searchParams.delete('variant');
    return u.toString();
  } catch {
    return url;
  }
}

async function scrapeProduct(url) {
  const cleanUrl = stripVariant(url);
  try {
    const product = await scrapeShopify(cleanUrl);
    const hasData = !!(product?.name || product?.product_name);
    return { success: hasData, product: { ...product, url: cleanUrl }, html: null };
  } catch (err) {
    return { success: false, product: null, error: err.message };
  }
}

// Supabase client (reuse existing pattern)
let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase connected for crawl agent');
  } else {
    console.log('⚠️  Supabase env vars missing — will save locally only');
  }
} catch (e) {
  console.log('⚠️  Supabase not available:', e.message);
}

// In-memory registry of active crawl jobs (keyed by jobId)
const activeJobs = new Map();

let nextJobId = 1;

/**
 * Start a crawl job.
 *
 * @param {object} config
 * @param {string}  config.startUrl         - Seed URL to begin crawling
 * @param {string}  config.outputDir        - Local disk path for storage
 * @param {number}  [config.maxPages]       - Max pages to crawl for URL discovery
 * @param {number}  [config.maxProducts]    - Stop after this many products
 * @param {boolean} [config.useBrowser]     - Use Playwright for JS-heavy sites
 * @param {number}  [config.concurrency]    - Parallel scrape workers
 * @param {number}  [config.delayMs]        - Delay between scrape requests (polite)
 * @param {boolean} [config.saveToSupabase] - Save structured data to Supabase
 * @param {boolean} [config.saveRawHtml]    - Save raw HTML snapshots locally
 * @param {boolean} [config.downloadImages] - Download product images locally
 * @param {string}  [config.supabaseTable]  - Supabase table name (default: 'crawled_products')
 *
 * @returns {string} jobId
 */
function startCrawl(config) {
  const jobId = `job_${nextJobId++}`;
  const domain = new URL(config.startUrl).hostname.replace('www.', '');

  const job = {
    jobId,
    domain,
    config,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stats: {
      pagesVisited: 0,
      urlsFound: 0,
      scraped: 0,
      saved: 0,
      failed: 0,
      skipped: 0,
    },
    errors: [],
    discoverer: null,
  };

  activeJobs.set(jobId, job);

  // Run async — don't await here so the API can return immediately
  _runCrawl(job, config).catch(err => {
    job.status = 'error';
    job.error = err.message;
    console.error(`[${jobId}] Fatal crawl error:`, err);
  });

  return jobId;
}

async function _runCrawl(job, config) {
  const {
    startUrl,
    outputDir,
    maxPages = 300,
    maxProducts = 2000,
    useBrowser = false,
    concurrency = 3,
    delayMs = 600,
    saveToSupabase = true,
    saveRawHtml = true,
    downloadImages = false,
    supabaseTable = 'crawled_products',
  } = config;

  const storage = new LocalStorage(outputDir, { saveRawHtml, downloadImages });

  // ── Phase 1: Discover product URLs ────────────────────────────────────────
  console.log(`[${job.jobId}] Phase 1: discovering URLs from ${startUrl}`);
  job.status = 'discovering';

  const discoverer = new LinkDiscoverer({
    startUrl,
    maxPages,
    maxProducts,
    useBrowser,
    concurrency: 2, // conservative for discovery
    delayMs: 400,
    onProgress: stats => {
      job.stats.pagesVisited = stats.visited;
      job.stats.urlsFound = stats.products;
    },
  });

  job.discoverer = discoverer;

  const { productUrls, visitedCount, errors: discoverErrors } = await discoverer.discover();

  job.stats.pagesVisited = visitedCount;
  job.stats.urlsFound = productUrls.length;
  job.errors.push(...discoverErrors.map(e => ({ phase: 'discover', ...e })));

  console.log(
    `[${job.jobId}] Found ${productUrls.length} product URLs across ${visitedCount} pages`
  );

  // Save discovery metadata
  storage.saveMeta(job.domain, {
    jobId: job.jobId,
    startUrl,
    startedAt: job.startedAt,
    urlsFound: productUrls.length,
    pagesVisited: visitedCount,
    productUrls,
  });

  if (productUrls.length === 0) {
    job.status = 'done';
    job.finishedAt = new Date().toISOString();
    console.log(`[${job.jobId}] No product URLs found — done.`);
    return;
  }

  // ── Phase 2: Scrape each product URL ──────────────────────────────────────
  console.log(`[${job.jobId}] Phase 2: scraping ${productUrls.length} products`);
  job.status = 'scraping';

  // Process in batches of `concurrency`
  for (let i = 0; i < productUrls.length && !discoverer.stopped; i += concurrency) {
    const batch = productUrls.slice(i, i + concurrency);
    await Promise.all(
      batch.map(url => _scrapeAndSave(url, job, storage, saveToSupabase, supabaseTable))
    );

    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }

    if (i % 20 === 0) {
      console.log(
        `[${job.jobId}] Progress: ${job.stats.scraped + job.stats.failed}/${productUrls.length} ` +
          `(saved: ${job.stats.saved}, failed: ${job.stats.failed})`
      );
    }
  }

  job.status = 'done';
  job.finishedAt = new Date().toISOString();

  // Final metadata update
  storage.saveMeta(job.domain, {
    jobId: job.jobId,
    startUrl,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    stats: job.stats,
  });

  console.log(
    `[${job.jobId}] Done. Saved: ${job.stats.saved}, Failed: ${job.stats.failed}`
  );
}

async function _scrapeAndSave(url, job, storage, saveToSupabase, supabaseTable) {
  // Skip if already saved locally
  if (storage.alreadySaved(job.domain, url)) {
    job.stats.skipped++;
    return;
  }

  let result;
  try {
    result = await scrapeProduct(url);
  } catch (err) {
    job.stats.failed++;
    job.errors.push({ phase: 'scrape', url, error: err.message });
    return;
  }

  if (!result?.success || !result?.product) {
    job.stats.failed++;
    job.errors.push({ phase: 'scrape', url, error: 'No product data returned' });
    return;
  }

  // Normalize to a consistent shape regardless of which scraper ran
  const raw = result.product;
  const product = {
    vendor_url:          raw.url || raw.vendor_url || url,
    product_name:        raw.name || raw.product_name || raw.title,
    brand:               raw.brand || raw.vendor || 'Unknown',
    original_price:      raw.price || raw.original_price,
    sale_price:          raw.sale_price || raw.price,
    is_on_sale:          raw.is_on_sale || false,
    currency:            raw.currency || 'USD',
    image_urls:          raw.image_urls || raw.images || [],
    description:         raw.description || '',
    availability:        raw.inStock === false ? 'out_of_stock' : (raw.availability || 'in_stock'),
    variants:            raw.variants || [],
    discount_percentage: raw.discount_percentage || null,
  };
  job.stats.scraped++;

  // ── Save locally ────────────────────────────────────────────────────────
  try {
    await storage.saveProduct(job.domain, product, result.html || null);
    job.stats.saved++;
  } catch (err) {
    console.error(`[${job.jobId}] Local save failed for ${url}:`, err.message);
  }

  // ── Save to Supabase ────────────────────────────────────────────────────
  if (saveToSupabase && supabase) {
    try {
      await _upsertToSupabase(supabase, supabaseTable, product, url, job.domain);
    } catch (err) {
      console.error(`[${job.jobId}] Supabase save failed for ${url}:`, err.message);
    }
  }
}

async function _upsertToSupabase(client, table, product, url, domain) {
  const row = {
    vendor_url: url,
    domain,
    product_name: product.product_name || product.name,
    brand: product.brand,
    original_price: product.original_price,
    sale_price: product.sale_price,
    currency: product.currency || 'USD',
    image_urls: product.image_urls || [],
    description: product.description,
    availability: product.availability,
    is_on_sale: product.is_on_sale || false,
    discount_percentage: product.discount_percentage,
    crawled_at: new Date().toISOString(),
    raw_data: product,
  };

  const { error } = await client
    .from(table)
    .upsert(row, { onConflict: 'vendor_url' });

  if (error) throw new Error(error.message);
}

/**
 * Stop a running crawl job.
 */
function stopCrawl(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return false;
  if (job.discoverer) job.discoverer.stop();
  job.status = 'stopped';
  job.finishedAt = new Date().toISOString();
  return true;
}

/**
 * Get status/stats for a job.
 */
function getJob(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return null;
  const { discoverer, ...safe } = job; // don't expose internal object
  return safe;
}

/**
 * List all jobs.
 */
function listJobs() {
  return [...activeJobs.values()].map(({ discoverer, ...safe }) => safe);
}

module.exports = { startCrawl, stopCrawl, getJob, listJobs };


// ── Standalone CLI usage ─────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();

  const startUrl = process.argv[2];
  const outputDir = process.argv[3] || './data/crawl-output';

  if (!startUrl) {
    console.error('Usage: node crawlers/crawl-agent.js <startUrl> [outputDir]');
    console.error('Example: node crawlers/crawl-agent.js https://example.com/shop /Volumes/MyDrive/bluestock-data');
    process.exit(1);
  }

  const jobId = startCrawl({
    startUrl,
    outputDir,
    maxPages: 300,
    maxProducts: 2000,
    useBrowser: false,
    concurrency: 3,
    delayMs: 600,
    saveToSupabase: true,
    saveRawHtml: true,
  });

  console.log(`Started crawl job: ${jobId}`);
  console.log('Press Ctrl+C to stop.\n');

  // Print progress every 10 seconds
  const interval = setInterval(() => {
    const job = getJob(jobId);
    if (!job) return;
    console.log(`[${jobId}] Status: ${job.status} | Pages: ${job.stats.pagesVisited} | Found: ${job.stats.urlsFound} | Saved: ${job.stats.saved} | Failed: ${job.stats.failed}`);
    if (job.status === 'done' || job.status === 'error' || job.status === 'stopped') {
      clearInterval(interval);
    }
  }, 10000);
}
