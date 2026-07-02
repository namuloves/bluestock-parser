const fs = require('fs');
const path = require('path');

/**
 * Durable failure log for the auto-fix loop.
 *
 * Every parse that fails (thrown error, success:false, or low-confidence
 * result) is appended as one JSON line to monitoring/data/failures-YYYY-MM-DD.jsonl.
 * The scheduled auto-fix agent reads these files, groups by hostname, and only
 * acts on sites failing across multiple distinct URLs (transient blips fail once;
 * a real parser bug fails on many). Keeping this append-only and dependency-free
 * means a logging error can never break a parse request.
 */

const DATA_DIR = path.join(__dirname, '..', 'monitoring', 'data');

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function dayStamp(date = new Date()) {
  // YYYY-MM-DD in UTC so files line up with the scheduled (UTC) agent.
  return date.toISOString().split('T')[0];
}

/**
 * Record one failure. Best-effort: never throws into the caller.
 * @param {object} f
 * @param {string} f.url            the product URL that failed
 * @param {string} f.error          human-readable error / reason
 * @param {'threw'|'success_false'|'low_confidence'} f.resultKind
 * @param {string[]} [f.strategiesTried]
 * @param {number} [f.confidence]
 */
function recordFailure(f = {}) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      url: f.url || '',
      hostname: hostnameOf(f.url || ''),
      resultKind: f.resultKind || 'unknown',
      error: (f.error || '').toString().slice(0, 500),
      strategiesTried: Array.isArray(f.strategiesTried) ? f.strategiesTried : [],
      confidence: typeof f.confidence === 'number' ? f.confidence : null,
    };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, `failures-${dayStamp()}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch (e) {
    // Logging must never break a request.
    console.error('⚠️  failure-log: could not record failure:', e.message);
  }
}

/**
 * Read failures for a given day (default: today), for the batch agent / tooling.
 * Returns [] if the file doesn't exist. Skips malformed lines.
 */
function readFailures(day = dayStamp()) {
  try {
    const file = path.join(DATA_DIR, `failures-${day}.jsonl`);
    const raw = fs.readFileSync(file, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Group a day's failures by hostname and return only those meeting the
 * distinct-URL threshold — the sites worth an automated investigation.
 * @param {object} [opts]
 * @param {string} [opts.day]
 * @param {number} [opts.minDistinctUrls=3]
 */
function failingSites({ day = dayStamp(), minDistinctUrls = 3 } = {}) {
  const byHost = new Map();
  for (const f of readFailures(day)) {
    if (!byHost.has(f.hostname)) byHost.set(f.hostname, { hostname: f.hostname, urls: new Set(), samples: [] });
    const g = byHost.get(f.hostname);
    g.urls.add(f.url);
    if (g.samples.length < 5) g.samples.push({ url: f.url, error: f.error, resultKind: f.resultKind });
  }
  return [...byHost.values()]
    .map((g) => ({ hostname: g.hostname, distinctUrls: g.urls.size, samples: g.samples }))
    .filter((g) => g.distinctUrls >= minDistinctUrls)
    .sort((a, b) => b.distinctUrls - a.distinctUrls);
}

module.exports = { recordFailure, readFailures, failingSites, dayStamp };
