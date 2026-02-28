/**
 * routes/crawler.js
 * REST API for managing crawl jobs.
 *
 * POST /crawler/start   - Start a new crawl
 * GET  /crawler/jobs    - List all jobs
 * GET  /crawler/job/:id - Get job status
 * POST /crawler/stop/:id - Stop a running job
 */

const express = require('express');
const router = express.Router();
const { startCrawl, stopCrawl, getJob, listJobs } = require('../crawlers/crawl-agent');

const DEFAULT_OUTPUT_DIR = process.env.CRAWL_OUTPUT_DIR || './data/crawl-output';

/**
 * POST /crawler/start
 * Body:
 * {
 *   "startUrl": "https://example.com/shop",
 *   "outputDir": "/Volumes/MyDrive/bluestock-data",   // optional
 *   "maxPages": 300,         // optional
 *   "maxProducts": 2000,     // optional
 *   "useBrowser": false,     // optional — true for JS-heavy sites
 *   "concurrency": 3,        // optional
 *   "delayMs": 600,          // optional
 *   "saveToSupabase": true,  // optional
 *   "saveRawHtml": true,     // optional
 *   "downloadImages": false, // optional
 *   "supabaseTable": "crawled_products"  // optional
 * }
 */
router.post('/start', (req, res) => {
  const { startUrl } = req.body;

  if (!startUrl) {
    return res.status(400).json({ error: 'startUrl is required' });
  }

  // Validate URL
  try {
    new URL(startUrl);
  } catch {
    return res.status(400).json({ error: 'startUrl is not a valid URL' });
  }

  const config = {
    startUrl,
    outputDir: req.body.outputDir || DEFAULT_OUTPUT_DIR,
    maxPages: req.body.maxPages || 300,
    maxProducts: req.body.maxProducts || 2000,
    useBrowser: req.body.useBrowser || false,
    concurrency: req.body.concurrency || 3,
    delayMs: req.body.delayMs !== undefined ? req.body.delayMs : 600,
    saveToSupabase: req.body.saveToSupabase !== false,
    saveRawHtml: req.body.saveRawHtml !== false,
    downloadImages: req.body.downloadImages || false,
    supabaseTable: req.body.supabaseTable || 'crawled_products',
  };

  const jobId = startCrawl(config);

  res.json({
    jobId,
    message: 'Crawl started',
    config: { ...config },
  });
});

/**
 * GET /crawler/jobs
 * Returns all jobs (active and finished).
 */
router.get('/jobs', (req, res) => {
  res.json(listJobs());
});

/**
 * GET /crawler/job/:id
 * Returns a single job's full status and stats.
 */
router.get('/job/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * POST /crawler/stop/:id
 * Gracefully stops a running crawl.
 */
router.post('/stop/:id', (req, res) => {
  const ok = stopCrawl(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Job not found or already finished' });
  res.json({ message: `Job ${req.params.id} stopped` });
});

module.exports = router;
