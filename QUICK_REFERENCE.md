# Firecrawl Integration - Quick Reference

## How Scraping Works Now

### For REI (Primary Firecrawl)
```
REI URL → Firecrawl (always) → Success/Failure
```

### For SSENSE (Firecrawl as Fallback)
```
SSENSE URL → Proxy Scraper → Success ✅
                ↓
              Failure ❌
                ↓
            Firecrawl → Success ✅
                ↓
              Failure ❌
                ↓
          Basic Fallback
```

### For Other Sites
```
Other URL → Universal Parser V3
               ↓
          Site-specific scraper
               ↓
          Shopify detection
               ↓
          Generic scraper
```

---

## Adding New Sites to Firecrawl

### Method 1: Make Firecrawl PRIMARY (recommended for heavily protected sites)

**Edit:** `scrapers/index.js`

```javascript
const FIRECRAWL_REQUIRED_SITES = [
  'rei.com',
  'nordstromrack.com',  // ← Add your site here
];
```

**Result:** Site will ALWAYS use Firecrawl first.

---

### Method 2: Make Firecrawl FALLBACK (recommended when you have a working scraper)

**Step 1:** Add to fallback list in `scrapers/index.js`

```javascript
const FIRECRAWL_FALLBACK_SITES = [
  'ssense.com',
  'saksfifthavenue.com',  // ← Add your site here
];
```

**Step 2:** Add fallback logic to the site's case statement

Find the case for your site and add:

```javascript
case 'saksfifthavenue':
  console.log('🛍️ Using Saks scraper');
  let saksProduct;

  try {
    saksProduct = await scrapeSaksFifthAvenue(url);
    console.log('✅ Saks scraper succeeded');
  } catch (error) {
    console.log('⚠️ Saks scraper failed:', error.message);

    // Add Firecrawl fallback
    if (firecrawlParser?.apiKey) {
      console.log('🔥 Trying Firecrawl fallback...');
      try {
        const firecrawlResult = await firecrawlParser.scrape(url);
        if (firecrawlResult.success) {
          return {
            success: true,
            product: {
              ...firecrawlResult.product,
              category: detectCategory(
                firecrawlResult.product.product_name || '',
                firecrawlResult.product.description || '',
                firecrawlResult.product.brand || '',
                null
              )
            }
          };
        }
      } catch (fcError) {
        console.log('⚠️ Firecrawl also failed:', fcError.message);
      }
    }

    // Continue with your existing fallback...
    throw error;
  }

  // Return saksProduct...
```

**OR use the helper function:**

```javascript
const { withFirecrawlFallback } = require('./firecrawl-fallback-helper');

case 'saksfifthavenue':
  return await withFirecrawlFallback(
    url,
    () => scrapeSaksFifthAvenue(url),
    firecrawlParser,
    { detectCategory }
  );
```

---

## Testing Firecrawl

### Test REI (primary)
```bash
node test-firecrawl-rei.js
```

### Test SSENSE (fallback)
```bash
# This will use proxy first, then Firecrawl if proxy fails
node test-firecrawl-ssense.js
```

### Test any site directly
```bash
node -e "
const FirecrawlParser = require('./scrapers/firecrawl-parser');
const parser = new FirecrawlParser();
parser.scrape('https://yoursite.com/product/...').then(console.log);
"
```

---

## Cost Management

### Current Usage
- REI: Every scrape uses Firecrawl (~$0.002 per product)
- SSENSE: Only failed proxy attempts use Firecrawl
- Other sites: Not using Firecrawl

### To Check Firecrawl Usage
Visit: https://firecrawl.dev/dashboard

### To Disable Firecrawl
Remove or comment out in `.env`:
```bash
# FIRECRAWL_API_KEY=fc-your-key
```

Parser will work normally without Firecrawl, just won't have the fallback option.

---

## Troubleshooting

### "Firecrawl parser not available"
- Check: Is `FIRECRAWL_API_KEY` set in `.env`?
- Restart server after adding key

### "Failed to extract required product data"
- Firecrawl got the page but couldn't parse it
- Check `partial_data` in error to see what it found
- May need custom parser for that site

### "Scrape timed out"
- Site is very slow or complex
- Increase timeout: `parser.scrape(url, { timeout: 120000 })`

### SSENSE still using Firecrawl when proxy works
- Make sure SSENSE is NOT in `FIRECRAWL_REQUIRED_SITES`
- Only in `FIRECRAWL_FALLBACK_SITES`

---

## Files Reference

| File | Purpose |
|------|---------|
| `scrapers/firecrawl-parser.js` | Main Firecrawl integration |
| `scrapers/index.js` | Routing logic (when to use Firecrawl) |
| `scrapers/firecrawl-fallback-helper.js` | Helper for adding fallback |
| `SCRAPING_FLOW.md` | Detailed flow diagrams |
| `FIRECRAWL_SETUP.md` | Full setup documentation |
| `test-firecrawl-*.js` | Test files |

---

## Example: Adding Nordstrom Rack with Firecrawl

**Scenario:** Nordstrom Rack blocks your scraper sometimes.

**Solution:** Add Firecrawl as fallback:

```javascript
// 1. Add to fallback list (scrapers/index.js)
const FIRECRAWL_FALLBACK_SITES = [
  'ssense.com',
  'nordstromrack.com'  // ← Add this
];

// 2. Add case in switch statement (or modify existing)
case 'nordstromrack':
  console.log('🛍️ Using Nordstrom Rack scraper');

  try {
    const result = await scrapeNordstromRack(url);
    return result;
  } catch (error) {
    // Firecrawl fallback
    if (firecrawlParser?.apiKey) {
      console.log('🔥 Trying Firecrawl...');
      const fcResult = await firecrawlParser.scrape(url);
      if (fcResult.success) return fcResult;
    }
    throw error;
  }
```

Done! Now Nordstrom Rack will use Firecrawl only when your scraper fails.

---

## Summary

**Firecrawl is:**
- ✅ Primary scraper for REI (always)
- ✅ Backup scraper for SSENSE (when proxy fails)
- ✅ Available as fallback for any site you add

**To use Firecrawl for a new site:**
1. Add to `FIRECRAWL_REQUIRED_SITES` (primary) or `FIRECRAWL_FALLBACK_SITES` (backup)
2. Add fallback logic if using as backup (see SSENSE example)
3. Test with `node test-firecrawl-*.js`

**Firecrawl is NOT used unless:**
- Site is in the configured lists
- AND `FIRECRAWL_API_KEY` is set in `.env`
