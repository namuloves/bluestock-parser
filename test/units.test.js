/**
 * Unit tests for extraction logic that has bitten us before.
 * Each test pins a specific past bug so it can't regress silently.
 */

// Routing for some sites (e.g. SSENSE) depends on a Firecrawl parser being
// configured. Set a key BEFORE requiring the scrapers so detectSite() reflects
// production routing deterministically, regardless of the local environment.
process.env.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'test-key-for-routing';

const { test } = require('node:test');
const assert = require('node:assert');

// ---------- Title cleaning (bug: "T-shirt" truncated to "T") ----------

const OpenGraphPlugin = require('../plugins/OpenGraphPlugin');

test('cleanTitle strips " – Store" suffix but keeps hyphenated words', () => {
  const plugin = new OpenGraphPlugin();

  assert.equal(
    plugin.cleanTitle('MM6 White Stamp Print T-shirt – SORRY THANKS I LOVE YOU'),
    'MM6 White Stamp Print T-shirt'
  );
  assert.equal(plugin.cleanTitle('Product Name | Brand'), 'Product Name');
  assert.equal(plugin.cleanTitle('Mid-Rise Jeans - Acme Store'), 'Mid-Rise Jeans');
  assert.equal(plugin.cleanTitle('T-shirt'), 'T-shirt');
  assert.equal(plugin.cleanTitle('Buy Wide-Leg Pants'), 'Wide-Leg Pants');
});

// ---------- Plugin merge (bug: 1 og:image beat a 6-image gallery) ----------

const { getPluginManager } = require('../plugins/PluginManager');

test('mergeResults prefers larger image gallery when priority winner has <3 images', () => {
  const pm = getPluginManager();
  const merged = pm.mergeResults([
    { success: true, plugin: 'JsonLdPlugin', data: { name: 'X', images: ['https://a/1.jpg'] } },
    { success: true, plugin: 'GenericExtractor', data: { images: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg', 'https://a/4.jpg'] } }
  ]);

  assert.equal(merged.images.length, 4, 'should take the 4-image gallery');
  assert.equal(merged._images_source, 'GenericExtractor');
  assert.equal(merged.name, 'X', 'non-image fields still come from priority winner');
});

test('mergeResults keeps priority winner when it already has a full gallery', () => {
  const pm = getPluginManager();
  const five = ['1', '2', '3', '4', '5'].map(n => `https://a/${n}.jpg`);
  const merged = pm.mergeResults([
    { success: true, plugin: 'JsonLdPlugin', data: { images: five } },
    { success: true, plugin: 'GenericExtractor', data: { images: [...five, 'https://a/junk-recommendation.jpg', 'https://a/junk2.jpg'] } }
  ]);

  assert.equal(merged._images_source, 'JsonLdPlugin', 'full gallery from priority winner should not be replaced');
  assert.equal(merged.images.length, 5);
});

// ---------- Quality gate (bug: stripped currency_source and original_price) ----------

const { getQualityGate } = require('../utils/qualityGate');

test('normalizeProduct passes through currency_source and original_price', () => {
  const qg = getQualityGate();
  const validation = qg.validate({
    name: 'Blue Wool Coat',
    price: 150,
    images: ['https://cdn.example.com/a.jpg'],
    currency: 'AUD',
    currency_source: 'shopify_json',
    sale_price: 100,
    original_price: 150,
    url: 'https://example.com/products/blue-wool-coat'
  });

  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.product.currency, 'AUD');
  assert.equal(validation.product.currency_source, 'shopify_json');
  assert.equal(validation.product.original_price, 150);
});

// ---------- Shopify cents logic (bug: real $150 became $1.50) ----------
// The logic lives inline in scrapers/shopify.js; this pins the rule it must follow.

test('cents division rule: only integer cent values divide by 100', () => {
  // Mirrors the toPrice rule used in scrapers (chiclara.js)
  const toPrice = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    return (Number.isInteger(n) && !String(v).includes('.')) ? n / 100 : n;
  };

  assert.equal(toPrice('5900'), 59, 'integer cents string');
  assert.equal(toPrice(5900), 59, 'integer cents number');
  assert.equal(toPrice('59.00'), 59, 'decimal string stays as-is');
  assert.equal(toPrice('150.00'), 150, 'a real $150 must stay $150');
  assert.equal(toPrice('1,234.56'), 1, 'comma-formatted handled by caller, not here');
});

// ---------- Fixture adapter URL normalization ----------

const { normalizeUrl } = require('./helpers/fixture-adapter');

test('fixture adapter normalizes URLs consistently', () => {
  assert.equal(
    normalizeUrl('https://www.soeur.fr/products/x?variant=123#top'),
    'soeur.fr/products/x'
  );
  assert.equal(normalizeUrl('http://example.com/a/'), 'example.com/a');
});

// ---------- Brand fallback (bug: twitter:site @handle leaked as brand) ----------
// Aggregators/marketplaces set twitter:site to their OWN account (e.g.
// "@shopondaydream"), which must never be treated as the product's brand.

const cheerio = require('cheerio');
const UniversalParserV3 = require('../universal-parser-v3');

test('extractBrandFallback ignores twitter:site social handles', () => {
  const parser = new UniversalParserV3({ logLevel: 'quiet' });
  const brandFrom = (head) =>
    parser.extractBrandFallback(cheerio.load(`<html><head>${head}</head></html>`), 'Some Product', 'example.com');

  // @-prefixed handle → not a brand
  assert.equal(brandFrom('<meta name="twitter:site" content="@shopondaydream">'), undefined);
  // single lowercase token (e.g. "nordstrom") → not a brand
  assert.equal(brandFrom('<meta name="twitter:site" content="somestore">'), undefined);
  // a real brand name with a space is still allowed through twitter:site
  assert.equal(brandFrom('<meta name="twitter:site" content="Ralph Lauren">'), 'Ralph Lauren');
  // product:brand always wins over a twitter handle
  assert.equal(
    brandFrom('<meta property="product:brand" content="Nike"><meta name="twitter:site" content="@somestore">'),
    'Nike'
  );
});

// ---------- Daydream site-specific extraction (OG-only, retailer from title) ----

test('daydream.ing extracts name/image and derives retailer, no price guess', () => {
  const parser = new UniversalParserV3({ logLevel: 'quiet' });
  const $ = cheerio.load(`<html><head>
    <meta property="og:title" content="J.Crew Feather jersey cropped T-shirt">
    <meta property="og:image" content="https://cdn.dahlialabs.dev/x.webp">
    <meta property="og:description" content="Introducing feather jersey.">
    <meta name="twitter:site" content="@shopondaydream">
  </head></html>`);
  const r = parser.extractSiteSpecific($, 'daydream.ing');
  assert.equal(r.name, 'J.Crew Feather jersey cropped T-shirt');
  assert.equal(r.brand, 'J.Crew');           // derived from title, NOT @shopondaydream
  assert.deepEqual(r.images, ['https://cdn.dahlialabs.dev/x.webp']);
  assert.equal(r.price, undefined);           // never guess among on-page prices
});

// ---------- Scene7 image handling (bugs: 304px thumbnails + only _main image) --
// Calvin Klein / PVH sites serve images via Adobe Scene7. Default renders are
// tiny thumbnails, and carousels lazy-load alternates so scrapes catch only _main.

test('normalizeImages upgrades Scene7 URLs to wid=1200 and strips existing sizing', () => {
  const parser = new UniversalParserV3({ logLevel: 'quiet' });
  const out = parser.normalizeImages([
    'https://calvinklein.scene7.com/is/image/CalvinKlein/470210G_YAF_main',
    'https://calvinklein.scene7.com/is/image/CalvinKlein/470210G_YAF_alternate1?$plp$',
  ], 'https://www.calvinklein.us/en/x.html');
  assert.equal(out[0], 'https://calvinklein.scene7.com/is/image/CalvinKlein/470210G_YAF_main?wid=1200');
  assert.equal(out[1], 'https://calvinklein.scene7.com/is/image/CalvinKlein/470210G_YAF_alternate1?wid=1200');
});

test('normalizeImages leaves non-Scene7 URLs untouched', () => {
  const parser = new UniversalParserV3({ logLevel: 'quiet' });
  const out = parser.normalizeImages([
    'https://cdn.shopify.com/s/files/x_720x.jpg?v=1',
  ], 'https://example.com/p');
  assert.equal(out[0], 'https://cdn.shopify.com/s/files/x_720x.jpg?v=1');
});

test('expandScene7Gallery only acts on a _main Scene7 URL', async () => {
  const parser = new UniversalParserV3({ logLevel: 'quiet' });
  // Non-Scene7 or non-_main URLs must return [] without any network calls.
  assert.deepEqual(await parser.expandScene7Gallery('https://example.com/a.jpg', 'https://example.com'), []);
  assert.deepEqual(await parser.expandScene7Gallery('https://x.scene7.com/is/image/X/foo_alternate1', 'https://x.com'), []);
});

// ---------- isUsableProduct gate (bug: Firecrawl thin-render junk returned as success) ----------
// SSENSE via Firecrawl sometimes returns a partial render or a "Page not found"
// page as success. The gate must reject unusable products so the frontend never
// gets "Could not extract product data" from a fake-success response.

const { isUsableProduct } = require('../scrapers/index');

test('isUsableProduct accepts a real product', () => {
  assert.equal(isUsableProduct({
    product_name: 'Gray Rig Chino Jeans', sale_price: 590,
    image_urls: ['https://img.ssensemedia.com/images/x_1/a.jpg'],
  }), true);
});

test('isUsableProduct rejects thin-render / error-page junk', () => {
  // "Page not found" title
  assert.equal(isUsableProduct({ product_name: 'SSENSE - Page not found', sale_price: 0, image_urls: ['x'] }), false);
  // zero price
  assert.equal(isUsableProduct({ product_name: 'Real Name', sale_price: 0, image_urls: ['x'] }), false);
  // no images
  assert.equal(isUsableProduct({ product_name: 'Real Name', sale_price: 100, image_urls: [] }), false);
  // no name
  assert.equal(isUsableProduct({ product_name: '', sale_price: 100, image_urls: ['x'] }), false);
  // null / empty
  assert.equal(isUsableProduct(null), false);
  assert.equal(isUsableProduct({}), false);
});

test('isUsableProduct accepts raw field shape too (name/price/images)', () => {
  assert.equal(isUsableProduct({ name: 'Thing', price: '42.00', images: ['y'] }), true);
});

// ---------- Shopify season-code brand guard (bug: Leset brand = "HSPF26 MAY") --
// Some single-brand Shopify stores put a season/label code in vendor + JSON-LD
// brand. That code must never be used as the brand — the domain/og:site_name
// fallback should supply the real one.

const { looksLikeSeasonCode } = require('../scrapers/shopify');

test('looksLikeSeasonCode flags season/label codes, not real brands', () => {
  // codes → true
  assert.equal(looksLikeSeasonCode('HSPF26 MAY'), true);
  assert.equal(looksLikeSeasonCode('SS24'), true);
  assert.equal(looksLikeSeasonCode('FW2025'), true);
  // real brands → false
  assert.equal(looksLikeSeasonCode('Leset'), false);
  assert.equal(looksLikeSeasonCode('Ralph Lauren'), false);
  assert.equal(looksLikeSeasonCode('A.P.C.'), false);
  assert.equal(looksLikeSeasonCode('3x1'), false);   // legit lowercase brand
  assert.equal(looksLikeSeasonCode(''), false);
  assert.equal(looksLikeSeasonCode(null), false);
});

// ---------- detectSite characterization (guards the routing-config refactor) ----
// A golden snapshot of detectSite() output across every routing branch. This
// pins current behavior so consolidating the scattered site config into one
// source of truth is provably behavior-preserving. If a routing change is
// intentional, update test/fixtures/detectSite-golden.json deliberately.

const { detectSite } = require('../scrapers/index');
const detectSiteGolden = require('./fixtures/detectSite-golden.json');

test('detectSite matches golden routing snapshot for all known sites', () => {
  for (const [url, expected] of Object.entries(detectSiteGolden)) {
    assert.strictEqual(detectSite(url), expected, `routing changed for ${url}`);
  }
});
