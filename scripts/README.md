# scripts/

One-off operational, debugging, and data-migration scripts. **Not part of the
running service** (`server.js` / `worker.js`) — these are run manually, usually
against production data, when investigating or fixing something.

Run from the repo root so relative `require('../...')` paths and `.env` resolve:

```bash
node scripts/check-job-status.js
```

## Categories

- `debug-*.js` — site-specific scraping debuggers (cultgaia, emurj, fred, zara, railway).
- `check-*.js` — read-only health/status probes (job queue, metrics, bunny images, railway).
- `find-*.js` — locate bad/missing image URLs.
- `recover-and-migrate-images.js`, `cleanup-supabase-storage.js` — image storage maintenance.
- `*-posts-categories*.js` — category backfill/reparse migrations.
- `bulk-import-example.js`, `create-spreadsheet.js`, `extract-sheet-urls.js`,
  `get-product-url.js`, `verify-images-work.js`, `analyze-domains.js`,
  `clean-urls.js` — data import/export and analysis utilities.

These mutate production data — read a script before running it.
