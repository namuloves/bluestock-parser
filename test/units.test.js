/**
 * Unit tests for extraction logic that has bitten us before.
 * Each test pins a specific past bug so it can't regress silently.
 */

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
