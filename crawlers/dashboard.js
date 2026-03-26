/**
 * dashboard.js
 * Serves a visual review UI for crawled product data.
 * Opens in your browser at http://localhost:4040
 *
 * Usage:
 *   node crawlers/dashboard.js [domain]
 *   node crawlers/dashboard.js commesi.com
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const OUTPUT_DIR = process.env.CRAWL_OUTPUT_DIR || './data/crawl-output';
const PORT = process.env.DASHBOARD_PORT || 4040;

// ── Data helpers ──────────────────────────────────────────────────────────────

function getDomains() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR).filter(d => {
    return fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory();
  });
}

function getProducts(domain) {
  const dir = path.join(OUTPUT_DIR, domain, 'products');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch { return null; }
    })
    .filter(Boolean);
}

function getMeta(domain) {
  const metaPath = path.join(OUTPUT_DIR, domain, 'crawl-meta.json');
  if (!fs.existsSync(metaPath)) return {};
  try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return {}; }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function html(strings, ...values) {
  return strings.reduce((out, str, i) => out + str + (values[i] ?? ''), '');
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Page renderers ────────────────────────────────────────────────────────────

function renderLayout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escape(title)} — Crawl Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; color: #1d1d1f; }
    a { color: #0071e3; text-decoration: none; }
    a:hover { text-decoration: underline; }

    header { background: #1d1d1f; color: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 17px; font-weight: 600; }
    header .breadcrumb { font-size: 13px; color: #86868b; }
    header .breadcrumb a { color: #6e9ef5; }

    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

    /* Domain list */
    .domain-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }
    .domain-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); cursor: pointer; transition: box-shadow .15s; }
    .domain-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .domain-card h2 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .domain-card .stat { font-size: 13px; color: #6e6e73; margin-top: 4px; }
    .domain-card .pill { display: inline-block; background: #e5f0ff; color: #0071e3; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin-top: 8px; }

    /* Toolbar */
    .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
    .toolbar input[type=search] { flex: 1; min-width: 200px; padding: 8px 14px; border: 1px solid #d2d2d7; border-radius: 8px; font-size: 14px; outline: none; }
    .toolbar input[type=search]:focus { border-color: #0071e3; }
    .toolbar select { padding: 8px 12px; border: 1px solid #d2d2d7; border-radius: 8px; font-size: 14px; background: #fff; }
    .toolbar .count { font-size: 13px; color: #6e6e73; margin-left: auto; }

    /* Stats bar */
    .stats-bar { display: flex; gap: 20px; flex-wrap: wrap; background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .stat-item { display: flex; flex-direction: column; gap: 2px; }
    .stat-item .label { font-size: 11px; color: #86868b; text-transform: uppercase; letter-spacing: .5px; }
    .stat-item .value { font-size: 22px; font-weight: 700; color: #1d1d1f; }

    /* Product grid */
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .product-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); transition: box-shadow .15s, transform .15s; }
    .product-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.12); transform: translateY(-2px); }
    .product-card .thumb { width: 100%; aspect-ratio: 1; object-fit: cover; background: #f0f0f3; display: block; }
    .product-card .thumb-placeholder { width: 100%; aspect-ratio: 1; background: linear-gradient(135deg,#f0f0f3,#e5e5ea); display: flex; align-items: center; justify-content: center; color: #c7c7cc; font-size: 32px; }
    .product-card .info { padding: 12px; }
    .product-card .name { font-size: 13px; font-weight: 600; line-height: 1.3; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-card .brand { font-size: 11px; color: #6e6e73; margin-bottom: 6px; }
    .product-card .price { font-size: 14px; font-weight: 700; }
    .product-card .price.sale { color: #ff3b30; }
    .product-card .price-original { font-size: 11px; color: #86868b; text-decoration: line-through; }
    .product-card .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 6px; }
    .badge-sale { background: #fff0ee; color: #ff3b30; }
    .badge-oos { background: #f5f5f7; color: #86868b; }
    .product-card .link { display: block; margin-top: 8px; font-size: 11px; color: #0071e3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Detail modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
    .modal-overlay.open { display: flex; }
    .modal { background: #fff; border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.3); }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 16px; border-bottom: 1px solid #f0f0f3; }
    .modal-header h2 { font-size: 18px; font-weight: 700; flex: 1; }
    .modal-close { background: #f5f5f7; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 12px; }
    .modal-body { padding: 20px 24px; display: flex; gap: 24px; flex-wrap: wrap; }
    .modal-images { display: flex; gap: 8px; flex-wrap: wrap; }
    .modal-images img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f3; }
    .modal-details { flex: 1; min-width: 240px; }
    .modal-details table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .modal-details td { padding: 6px 0; vertical-align: top; }
    .modal-details td:first-child { color: #6e6e73; width: 120px; }
    .modal-raw { padding: 0 24px 20px; }
    .modal-raw summary { font-size: 12px; color: #86868b; cursor: pointer; }
    .modal-raw pre { background: #f5f5f7; border-radius: 8px; padding: 12px; font-size: 11px; overflow-x: auto; margin-top: 8px; max-height: 200px; }

    /* Pagination */
    .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
    .pagination button { padding: 7px 14px; border: 1px solid #d2d2d7; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; }
    .pagination button.active { background: #0071e3; color: #fff; border-color: #0071e3; }
    .pagination button:hover:not(.active) { background: #f5f5f7; }

    @media (max-width: 600px) {
      .product-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      .modal-body { flex-direction: column; }
    }
  </style>
</head>
<body>
${body}
<script>
// Modal logic
function openModal(data) {
  const obj = JSON.parse(decodeURIComponent(data));
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = obj.product_name || 'Product';

  const imgs = (obj.image_urls || []).slice(0, 8);
  document.getElementById('modal-images').innerHTML = imgs.length
    ? imgs.map(u => '<img src="' + u + '" onerror="this.style.display=\\'none\\'">').join('')
    : '<span style="color:#c7c7cc;font-size:13px">No images</span>';

  const fields = [
    ['Brand', obj.brand],
    ['Price', obj.currency + ' ' + (obj.original_price ?? '—')],
    ['Sale Price', obj.is_on_sale ? obj.currency + ' ' + obj.sale_price : '—'],
    ['Discount', obj.discount_percentage ? obj.discount_percentage + '%' : '—'],
    ['Availability', obj.availability],
    ['Variants', (obj.variants || []).length],
    ['Images', (obj.image_urls || []).length],
    ['Saved at', obj._saved_at ? new Date(obj._saved_at).toLocaleString() : '—'],
  ];
  document.getElementById('modal-fields').innerHTML = fields
    .map(([k,v]) => '<tr><td>' + k + '</td><td>' + (v ?? '—') + '</td></tr>')
    .join('');

  document.getElementById('modal-link').href = obj.vendor_url || '#';
  document.getElementById('modal-link').textContent = obj.vendor_url || '';
  document.getElementById('modal-raw-pre').textContent = JSON.stringify(obj, null, 2);

  m.classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.getElementById('modal').addEventListener('click', function(e) { if(e.target===this) closeModal(); });

// Search + filter (client-side)
let allCards = [];
let currentPage = 1;
const PAGE_SIZE = 48;

function initCards() {
  allCards = Array.from(document.querySelectorAll('.product-card'));
}

function filterAndPage() {
  const q = (document.getElementById('search')?.value || '').toLowerCase();
  const sort = document.getElementById('sort')?.value || 'default';
  const avail = document.getElementById('avail')?.value || 'all';

  let cards = allCards.filter(c => {
    const name = (c.dataset.name || '').toLowerCase();
    const brand = (c.dataset.brand || '').toLowerCase();
    const matchQ = !q || name.includes(q) || brand.includes(q);
    const matchAvail = avail === 'all' || c.dataset.avail === avail;
    return matchQ && matchAvail;
  });

  // Sort
  if (sort === 'price-asc') cards.sort((a,b) => parseFloat(a.dataset.price||0) - parseFloat(b.dataset.price||0));
  else if (sort === 'price-desc') cards.sort((a,b) => parseFloat(b.dataset.price||0) - parseFloat(a.dataset.price||0));
  else if (sort === 'name') cards.sort((a,b) => (a.dataset.name||'').localeCompare(b.dataset.name||''));
  else if (sort === 'sale') cards = [...cards.filter(c=>c.dataset.sale==='true'), ...cards.filter(c=>c.dataset.sale!=='true')];

  // Count
  const countEl = document.getElementById('result-count');
  if (countEl) countEl.textContent = cards.length + ' products';

  // Paginate
  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  currentPage = Math.min(currentPage, totalPages || 1);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = new Set(cards.slice(start, start + PAGE_SIZE).map(c => c.id));

  allCards.forEach(c => { c.style.display = visible.has(c.id) ? '' : 'none'; });

  // Pagination buttons
  const pag = document.getElementById('pagination');
  if (pag) {
    pag.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === currentPage) btn.className = 'active';
      btn.addEventListener('click', () => { currentPage = i; filterAndPage(); window.scrollTo(0,0); });
      pag.appendChild(btn);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initCards();
  filterAndPage();
  document.getElementById('search')?.addEventListener('input', () => { currentPage = 1; filterAndPage(); });
  document.getElementById('sort')?.addEventListener('change', () => { currentPage = 1; filterAndPage(); });
  document.getElementById('avail')?.addEventListener('change', () => { currentPage = 1; filterAndPage(); });
});
</script>
</body>
</html>`;
}

function renderHome(domains) {
  const cards = domains.map(domain => {
    const meta = getMeta(domain);
    const count = fs.existsSync(path.join(OUTPUT_DIR, domain, 'products'))
      ? fs.readdirSync(path.join(OUTPUT_DIR, domain, 'products')).filter(f => f.endsWith('.json')).length
      : 0;
    const crawledAt = meta.finishedAt ? new Date(meta.finishedAt).toLocaleDateString() : '—';
    return `<a href="/domain/${encodeURIComponent(domain)}" style="text-decoration:none">
      <div class="domain-card">
        <h2>${escape(domain)}</h2>
        <div class="stat">📦 ${count} products</div>
        <div class="stat">🕐 Crawled: ${crawledAt}</div>
        ${meta.startUrl ? `<div class="stat" style="margin-top:8px;font-size:12px;color:#0071e3">${escape(meta.startUrl)}</div>` : ''}
        <span class="pill">View →</span>
      </div>
    </a>`;
  }).join('');

  const body = `
    <header>
      <h1>🗂 Crawl Dashboard</h1>
    </header>
    <div class="container">
      <h2 style="margin:20px 0 4px;font-size:20px">Crawled Sites</h2>
      <p style="color:#6e6e73;font-size:13px">${domains.length} domain${domains.length !== 1 ? 's' : ''} in <code>${escape(OUTPUT_DIR)}</code></p>
      ${domains.length === 0
        ? '<p style="margin-top:40px;color:#86868b;text-align:center">No crawl data found. Run a crawl first.</p>'
        : `<div class="domain-grid">${cards}</div>`
      }
    </div>
    <div class="modal-overlay" id="modal"><div class="modal"></div></div>`;
  return renderLayout('Home', body);
}

function renderDomain(domain, products) {
  const meta = getMeta(domain);
  const totalProducts = products.length;
  const onSale = products.filter(p => p.is_on_sale).length;
  const withImages = products.filter(p => (p.image_urls || []).length > 0).length;
  const avgPrice = products.length
    ? (products.reduce((s, p) => s + (p.original_price || 0), 0) / products.length).toFixed(2)
    : 0;

  const cards = products.map((p, i) => {
    const img = (p.image_urls || [])[0];
    const isSale = p.is_on_sale;
    const isOos = p.availability === 'out_of_stock';
    const dataAttr = encodeURIComponent(JSON.stringify(p));

    return `<div class="product-card" id="card-${i}"
      data-name="${escape(p.product_name || '')}"
      data-brand="${escape(p.brand || '')}"
      data-price="${p.original_price || 0}"
      data-sale="${isSale}"
      data-avail="${p.availability || 'in_stock'}"
      onclick="openModal('${dataAttr}')">
      ${img
        ? `<img class="thumb" src="${escape(img)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="thumb-placeholder">👗</div>`
      }
      <div class="info">
        <div class="name" title="${escape(p.product_name || '')}">${escape(p.product_name || '—')}</div>
        <div class="brand">${escape(p.brand || '')}</div>
        <div class="price ${isSale ? 'sale' : ''}">
          ${p.currency || 'USD'} ${p.original_price ?? '—'}
          ${isSale && p.sale_price !== p.original_price
            ? `<span class="price-original">${p.currency} ${p.original_price}</span>`
            : ''}
        </div>
        ${isSale ? '<span class="badge badge-sale">SALE</span>' : ''}
        ${isOos ? '<span class="badge badge-oos">Out of Stock</span>' : ''}
        <a class="link" href="${escape(p.vendor_url || '#')}" target="_blank" onclick="event.stopPropagation()">${escape((p.vendor_url || '').replace(/^https?:\/\//, ''))}</a>
      </div>
    </div>`;
  }).join('');

  const body = `
    <header>
      <h1>🗂 Crawl Dashboard</h1>
      <span class="breadcrumb"><a href="/">Home</a> / ${escape(domain)}</span>
    </header>
    <div class="container">
      <div class="stats-bar">
        <div class="stat-item"><span class="label">Products</span><span class="value">${totalProducts}</span></div>
        <div class="stat-item"><span class="label">With Images</span><span class="value">${withImages}</span></div>
        <div class="stat-item"><span class="label">On Sale</span><span class="value">${onSale}</span></div>
        <div class="stat-item"><span class="label">Avg Price</span><span class="value">$${avgPrice}</span></div>
        <div class="stat-item"><span class="label">Pages Crawled</span><span class="value">${meta.pagesVisited || '—'}</span></div>
        <div class="stat-item" style="margin-left:auto"><span class="label">Crawled</span><span class="value" style="font-size:14px">${meta.finishedAt ? new Date(meta.finishedAt).toLocaleString() : '—'}</span></div>
      </div>

      <div class="toolbar">
        <input type="search" id="search" placeholder="Search by name or brand…">
        <select id="sort">
          <option value="default">Sort: Default</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="name">Name A–Z</option>
          <option value="sale">Sale first</option>
        </select>
        <select id="avail">
          <option value="all">All</option>
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <span class="count" id="result-count">${totalProducts} products</span>
      </div>

      <div class="product-grid">${cards}</div>
      <div class="pagination" id="pagination"></div>
    </div>

    <!-- Detail modal -->
    <div class="modal-overlay" id="modal">
      <div class="modal">
        <div class="modal-header">
          <h2 id="modal-title"></h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="flex:0 0 auto">
            <div class="modal-images" id="modal-images"></div>
          </div>
          <div class="modal-details">
            <table id="modal-fields"></table>
            <a id="modal-link" href="#" target="_blank" style="display:block;margin-top:12px;font-size:12px;word-break:break-all"></a>
          </div>
        </div>
        <div class="modal-raw">
          <details>
            <summary>Raw JSON</summary>
            <pre id="modal-raw-pre"></pre>
          </details>
        </div>
      </div>
    </div>`;

  return renderLayout(domain, body);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);

  // Home
  if (pathname === '/' || pathname === '') {
    const domains = getDomains();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderHome(domains));
  }

  // Domain view
  const domainMatch = pathname.match(/^\/domain\/(.+)$/);
  if (domainMatch) {
    const domain = decodeURIComponent(domainMatch[1]);
    const products = getProducts(domain);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderDomain(domain, products));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  const addr = `http://localhost:${PORT}`;
  console.log(`\n🗂  Crawl Dashboard running at ${addr}`);
  console.log(`   Data directory: ${OUTPUT_DIR}`);
  console.log(`   Press Ctrl+C to stop\n`);

  // Auto-open in browser
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  require('child_process').exec(`${open} ${addr}`);
});
