/**
 * local-storage.js
 * Saves crawl data to local disk (your 1TB external drive or any path).
 *
 * Structure on disk:
 *   <outputDir>/
 *     <domain>/
 *       products/
 *         <slug>.json        ← structured product data
 *       raw/
 *         <slug>.html        ← raw HTML snapshot
 *       images/
 *         <slug>-0.jpg       ← downloaded images (optional)
 *       index.jsonl          ← newline-delimited JSON log of all products
 *       crawl-meta.json      ← crawl stats and config
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class LocalStorage {
  /**
   * @param {string} outputDir  - Root output path, e.g. "/Volumes/MyDrive/bluestock-data"
   * @param {object} options
   * @param {boolean} options.saveRawHtml   - Save raw HTML snapshots (default: true)
   * @param {boolean} options.downloadImages - Download images locally (default: false)
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.saveRawHtml = options.saveRawHtml !== false;
    this.downloadImages = options.downloadImages || false;
  }

  _domainDir(domain) {
    const dir = path.join(this.outputDir, domain);
    fs.mkdirSync(path.join(dir, 'products'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
    if (this.downloadImages) {
      fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
    }
    return dir;
  }

  _slug(url) {
    // Turn URL into a safe filename
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
  }

  /**
   * Save a scraped product to disk.
   * @param {string} domain
   * @param {object} product  - structured product data
   * @param {string} [rawHtml]
   */
  async saveProduct(domain, product, rawHtml = null) {
    const dir = this._domainDir(domain);
    const slug = this._slug(product.vendor_url || product.url || Date.now().toString());

    // Structured JSON
    const jsonPath = path.join(dir, 'products', `${slug}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(product, null, 2), 'utf8');

    // Append to JSONL index
    const indexPath = path.join(dir, 'index.jsonl');
    fs.appendFileSync(
      indexPath,
      JSON.stringify({ ...product, _saved_at: new Date().toISOString() }) + '\n',
      'utf8'
    );

    // Raw HTML snapshot
    if (this.saveRawHtml && rawHtml) {
      const htmlPath = path.join(dir, 'raw', `${slug}.html`);
      fs.writeFileSync(htmlPath, rawHtml, 'utf8');
    }

    // Download images
    if (this.downloadImages && product.image_urls?.length) {
      await this._downloadImages(dir, slug, product.image_urls);
    }

    return jsonPath;
  }

  _highQualityUrl(url) {
    // Shopify CDN: strip width/height constraints to get the original master image
    // e.g. ?v=123&width=800 → ?v=123  (keeps version param for cache busting)
    try {
      const u = new URL(url);
      u.searchParams.delete('width');
      u.searchParams.delete('height');
      u.searchParams.delete('w');
      u.searchParams.delete('h');
      // Also strip inline size suffixes from the path: _200x300. or _800x.
      let p = u.pathname.replace(/_\d+x\d*(\.[a-z]+)$/i, '$1').replace(/_\d+x(\.[a-z]+)$/i, '$1');
      u.pathname = p;
      return u.toString();
    } catch {
      return url;
    }
  }

  async _downloadImages(dir, slug, urls) {
    for (let i = 0; i < urls.length; i++) {
      const rawUrl = urls[i];
      const hqUrl = this._highQualityUrl(rawUrl);
      try {
        const ext = hqUrl.split('?')[0].split('.').pop()?.slice(0, 4) || 'jpg';
        const imgPath = path.join(dir, 'images', `${slug}-${i}.${ext}`);
        if (fs.existsSync(imgPath)) continue; // skip already downloaded
        const resp = await axios.get(hqUrl, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*',
          },
        });
        fs.writeFileSync(imgPath, resp.data);
      } catch {
        // Non-fatal — skip broken image
      }
    }
  }

  /**
   * Write or update crawl metadata.
   */
  saveMeta(domain, meta) {
    const dir = this._domainDir(domain);
    const metaPath = path.join(dir, 'crawl-meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  /**
   * Count saved products for a domain.
   */
  getCount(domain) {
    const dir = path.join(this.outputDir, domain, 'products');
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
  }

  /**
   * Check if a product URL has already been saved.
   */
  alreadySaved(domain, url) {
    const slug = this._slug(url);
    const p = path.join(this.outputDir, domain, 'products', `${slug}.json`);
    return fs.existsSync(p);
  }
}

module.exports = LocalStorage;
