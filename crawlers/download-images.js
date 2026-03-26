/**
 * download-images.js
 * Downloads images for already-crawled products at highest quality.
 * Reads from the products/ directory — no re-scraping needed.
 *
 * Usage:
 *   node crawlers/download-images.js <domain>
 *   node crawlers/download-images.js commesi.com
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const LocalStorage = require('./local-storage');

const domain = process.argv[2];
const imageFolder = process.argv[3] || 'images'; // e.g. "images-v2"
if (!domain) {
  console.error('Usage: node crawlers/download-images.js <domain> [folder-name]');
  console.error('Example: node crawlers/download-images.js commesi.com images-v2');
  process.exit(1);
}

const OUTPUT_DIR = process.env.CRAWL_OUTPUT_DIR || './data/crawl-output';
const CONCURRENCY = 4; // parallel image downloads per product

async function run() {
  const storage = new LocalStorage(OUTPUT_DIR, { downloadImages: true });
  const productsDir = path.join(OUTPUT_DIR, domain, 'products');
  const imagesDir = path.join(OUTPUT_DIR, domain, imageFolder);
  fs.mkdirSync(imagesDir, { recursive: true });

  if (!fs.existsSync(productsDir)) {
    console.error(`No products found for domain: ${domain}`);
    process.exit(1);
  }

  const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.json'));
  console.log(`\n📦 Found ${files.length} products for ${domain}`);
  console.log(`📁 Saving images to: ${imagesDir}\n`);

  let totalImages = 0;
  let downloadedImages = 0;
  let skippedImages = 0;
  let failedImages = 0;
  let productsWithImages = 0;

  for (let i = 0; i < files.length; i++) {
    const product = JSON.parse(fs.readFileSync(path.join(productsDir, files[i]), 'utf8'));
    const urls = product.image_urls || [];

    if (urls.length === 0) continue;
    productsWithImages++;
    totalImages += urls.length;

    const slug = files[i].replace('.json', '');

    // Download in small batches per product
    for (let j = 0; j < urls.length; j += CONCURRENCY) {
      const batch = urls.slice(j, j + CONCURRENCY);
      await Promise.all(batch.map(async (rawUrl, batchIdx) => {
        const imgIdx = j + batchIdx;
        const hqUrl = storage._highQualityUrl(rawUrl);
        const ext = hqUrl.split('?')[0].split('.').pop()?.slice(0, 4) || 'jpg';
        const imgPath = path.join(imagesDir, `${slug}-${imgIdx}.${ext}`);

        if (fs.existsSync(imgPath)) {
          skippedImages++;
          return;
        }

        try {
          const axios = require('axios');
          const resp = await axios.get(hqUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/*,*/*',
            },
          });
          fs.writeFileSync(imgPath, resp.data);
          const kb = Math.round(resp.data.byteLength / 1024);
          downloadedImages++;
          process.stdout.write(`  ✅ ${slug.slice(0, 40)}… img ${imgIdx} (${kb}KB)\n`);
        } catch (err) {
          failedImages++;
          process.stdout.write(`  ❌ img ${imgIdx} failed: ${err.message}\n`);
        }
      }));
    }

    // Progress line
    const pct = Math.round(((i + 1) / files.length) * 100);
    process.stdout.write(`\r[${pct}%] ${i + 1}/${files.length} products | downloaded: ${downloadedImages} | skipped: ${skippedImages} | failed: ${failedImages}  `);
  }

  // Final summary
  const totalSize = getTotalSize(imagesDir);
  console.log(`\n\n✅ Done!`);
  console.log(`   Products with images : ${productsWithImages}`);
  console.log(`   Total image URLs     : ${totalImages}`);
  console.log(`   Downloaded           : ${downloadedImages}`);
  console.log(`   Already existed      : ${skippedImages}`);
  console.log(`   Failed               : ${failedImages}`);
  console.log(`   Total size on disk   : ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Location             : ${imagesDir}`);
}

function getTotalSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(dir, f)).size; } catch { return sum; }
  }, 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
