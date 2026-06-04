/**
 * Axios fixture adapter for offline regression tests.
 *
 * Replaces axios's HTTP transport with a lookup into test/fixtures/, so the
 * parsers run against frozen copies of real pages. No network access happens
 * during tests; unknown URLs reject like a network error so code paths that
 * tolerate fetch failures behave the same as in production.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const manifest = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8')
).fixtures;

/** Normalize a URL the same way manifest keys are normalized. */
function normalizeUrl(url) {
  return String(url)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/$/, '');
}

let originalAdapter = null;
const misses = [];

function install() {
  if (originalAdapter !== null) return; // already installed
  originalAdapter = axios.defaults.adapter;

  axios.defaults.adapter = async (config) => {
    const fullUrl = config.baseURL ? config.baseURL + config.url : config.url;
    const key = normalizeUrl(fullUrl);
    const file = manifest[key];

    if (!file) {
      misses.push(key);
      const err = new Error(`Fixture miss (offline test): ${key}`);
      err.code = 'ENOTFOUND';
      err.config = config;
      throw err;
    }

    const filePath = path.join(FIXTURES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const isJson = file.endsWith('.json');

    return {
      data: isJson ? JSON.parse(raw) : raw,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': isJson ? 'application/json' : 'text/html' },
      config,
      request: {}
    };
  };
}

function uninstall() {
  if (originalAdapter !== null) {
    axios.defaults.adapter = originalAdapter;
    originalAdapter = null;
  }
}

module.exports = { install, uninstall, normalizeUrl, misses };
