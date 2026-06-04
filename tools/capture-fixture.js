#!/usr/bin/env node
/**
 * Capture a live product page as an offline test fixture.
 *
 * Usage: node tools/capture-fixture.js <product-url> <fixture-name>
 * Example: node tools/capture-fixture.js https://rachelcomey.com/products/yanni-skirt rachelcomey
 *
 * Saves test/fixtures/<name>/page.html (+ product.json for Shopify sites)
 * and registers the URLs in test/fixtures/manifest.json.
 * Then add a case to CASES in test/regression.test.js.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const FIXTURES_DIR = path.join(__dirname, '..', 'test', 'fixtures');

function normalizeUrl(url) {
  return String(url)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/$/, '');
}

async function main() {
  const [url, name] = process.argv.slice(2);
  if (!url || !name) {
    console.error('Usage: node tools/capture-fixture.js <product-url> <fixture-name>');
    process.exit(1);
  }

  const dir = path.join(FIXTURES_DIR, name);
  fs.mkdirSync(dir, { recursive: true });

  const manifestPath = path.join(FIXTURES_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Page HTML
  console.log(`📄 Fetching ${url}`);
  const page = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
  fs.writeFileSync(path.join(dir, 'page.html'), page.data);
  manifest.fixtures[normalizeUrl(url)] = `${name}/page.html`;
  console.log(`✅ Saved page.html (${page.data.length} bytes)`);

  // 2. Shopify product JSON (if applicable)
  const m = url.match(/^(https?:\/\/[^/]+)(?:\/collections\/[^/]+)?\/products\/([^/?#]+)/);
  if (m) {
    const jsonUrl = `${m[1]}/products/${m[2].replace(/\.json$/, '')}.json`;
    try {
      const resp = await axios.get(jsonUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: 15000,
        validateStatus: s => s === 200
      });
      if (resp.data?.product) {
        fs.writeFileSync(path.join(dir, 'product.json'), JSON.stringify(resp.data, null, 2));
        // Register both URL shapes (with and without /collections/ prefix)
        manifest.fixtures[normalizeUrl(jsonUrl)] = `${name}/product.json`;
        manifest.fixtures[normalizeUrl(url) + '.json'] = `${name}/product.json`;
        const v = resp.data.product.variants?.[0] || {};
        console.log(`✅ Saved product.json — vendor: ${resp.data.product.vendor}, price: ${v.price} ${v.price_currency || ''}`);
      }
    } catch (e) {
      console.log(`ℹ️ No Shopify product JSON (${e.message}) — HTML-only fixture`);
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ Manifest updated. Now add a case to CASES in test/regression.test.js`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
