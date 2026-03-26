/**
 * rescrape-products.js
 * Re-scrapes already-saved products to update their data (especially image_urls).
 * Updates the JSON files in-place — does NOT re-crawl for new URLs.
 *
 * Usage: node crawlers/rescrape-products.js <domain>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { scrapeShopify } = require('../scrapers/shopify');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node crawlers/rescrape-products.js <domain>');
  process.exit(1);
}

const OUTPUT_DIR = process.env.CRAWL_OUTPUT_DIR || './data/crawl-output';
const CONCURRENCY = 3;
const DELAY_MS = 500;

async function run() {
  const productsDir = path.join(OUTPUT_DIR, domain, 'products');
  const indexPath = path.join(OUTPUT_DIR, domain, 'index.jsonl');

  if (!fs.existsSync(productsDir)) {
    console.error(`No products dir found for: ${domain}`);
    process.exit(1);
  }

  const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.json'));
  console.log(`\n🔄 Re-scraping ${files.length} products for ${domain}...\n`);

  let updated = 0, failed = 0, unchanged = 0;
  const newIndex = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async f => {
      const filePath = path.join(productsDir, f);
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const url = existing.vendor_url;
      if (!url) { unchanged++; return; }

      try {
        const raw = await scrapeShopify(url);
        if (!raw?.name) { failed++; return; }

        // Normalize to same shape as crawl-agent
        const product = {
          vendor_url:          raw.url || url,
          product_name:        raw.name || raw.product_name,
          brand:               raw.brand || raw.vendor || existing.brand,
          original_price:      raw.price ?? existing.original_price,
          sale_price:          raw.sale_price ?? raw.price ?? existing.sale_price,
          is_on_sale:          raw.is_on_sale || false,
          currency:            raw.currency || existing.currency || 'USD',
          image_urls:          raw.images || raw.image_urls || existing.image_urls || [],
          description:         raw.description || existing.description || '',
          availability:        raw.inStock === false ? 'out_of_stock' : (raw.availability || 'in_stock'),
          variants:            raw.variants || existing.variants || [],
          discount_percentage: raw.discount_percentage || existing.discount_percentage || null,
          _saved_at:           existing._saved_at,
          _updated_at:         new Date().toISOString(),
        };

        fs.writeFileSync(filePath, JSON.stringify(product, null, 2), 'utf8');
        newIndex.push(product);
        updated++;
      } catch (err) {
        failed++;
        newIndex.push(existing); // keep old data
      }
    }));

    await new Promise(r => setTimeout(r, DELAY_MS));
    const pct = Math.round(((i + CONCURRENCY) / files.length) * 100);
    process.stdout.write(`\r[${Math.min(pct,100)}%] ${Math.min(i + CONCURRENCY, files.length)}/${files.length} | updated: ${updated} | failed: ${failed}  `);
  }

  // Rewrite index.jsonl with fresh data
  fs.writeFileSync(
    indexPath,
    newIndex.map(p => JSON.stringify({ ...p, _saved_at: p._saved_at || new Date().toISOString() })).join('\n') + '\n',
    'utf8'
  );

  console.log(`\n\n✅ Done!`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Failed  : ${failed}`);
  console.log(`   Skipped : ${unchanged}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
