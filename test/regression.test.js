/**
 * Offline regression tests for the production parsers (v3 + lean).
 *
 * Runs both parsers against frozen HTML/JSON fixtures of real product pages
 * and asserts the extracted name, brand, price, currency, and image count.
 * If a parser change breaks a site that used to work, these fail.
 *
 * Run: npm test          (all tests)
 *      node --test test/regression.test.js
 *
 * Add a new site: node tools/capture-fixture.js <product-url> <name>
 * then add a case to CASES below.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fixtureAdapter = require('./helpers/fixture-adapter');

// Expected values come from the frozen fixtures (Shopify product JSON),
// so they never drift even if the live sites change.
const CASES = [
  {
    name: 'sorrythanksiloveyou.com (AUD, multi-brand boutique)',
    url: 'https://sorrythanksiloveyou.com/collections/new-arrivals/products/mm6-black-logo-t-shirt-copy',
    expected: {
      name: 'MM6 White Stamp Print T-shirt',
      brand: 'MM6 Maison Margiela', // vendor, NOT the store name
      price: 445,
      currency: 'AUD',
      minImages: 5
    }
  },
  {
    name: 'rachelcomey.com (USD, single-brand)',
    url: 'https://rachelcomey.com/products/yanni-skirt-organza-bouquet',
    expected: {
      name: 'Yanni Skirt',
      brand: 'Rachel Comey',
      price: 536.6,
      currency: 'USD',
      minImages: 5
    }
  },
  {
    name: 'soeur.fr (EUR, single-brand)',
    url: 'https://www.soeur.fr/products/sandales-velika-gris-anthracite-cha1309velika23wgri03',
    expected: {
      name: 'SANDALES VELIKA GRISES',
      brand: 'Soeur',
      price: 142.5,
      currency: 'EUR',
      minImages: 4
    }
  }
];

before(() => fixtureAdapter.install());
after(() => fixtureAdapter.uninstall());

// ---------- Universal Parser V3 ----------

const UniversalParserV3 = require('../universal-parser-v3');

for (const c of CASES) {
  test(`v3: ${c.name}`, async () => {
    const parser = new UniversalParserV3();
    const r = await parser.parse(c.url);

    assert.equal(r.name, c.expected.name, 'product name');
    assert.equal(r.brand, c.expected.brand, 'brand (must be vendor, not store name)');
    assert.equal(r.price, c.expected.price, 'canonical store price');
    assert.equal(r.currency, c.expected.currency, 'canonical currency');
    assert.ok(
      (r.images || []).length >= c.expected.minImages,
      `expected >= ${c.expected.minImages} images, got ${(r.images || []).length}`
    );
  });
}

// ---------- Lean Parser ----------

const { getLeanParser } = require('../universal-parser-lean');

for (const c of CASES) {
  test(`lean: ${c.name}`, async () => {
    const parser = getLeanParser();
    const r = await parser.parse(c.url, { skipRender: true, bypassCache: true });

    assert.equal(r.success, true, `lean parse should succeed: ${JSON.stringify(r.errors || r.error || '')}`);
    const p = r.product;
    assert.equal(p.name, c.expected.name, 'product name');
    assert.equal(p.brand, c.expected.brand, 'brand (must be vendor, not store name)');
    assert.equal(p.price, c.expected.price, 'canonical store price');
    assert.equal(p.currency, c.expected.currency, 'canonical currency');
    assert.ok(
      (p.images || []).length >= c.expected.minImages,
      `expected >= ${c.expected.minImages} images, got ${(p.images || []).length}`
    );
  });
}
