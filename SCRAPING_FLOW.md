# Bluestock Parser - Scraping Logic Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    /scrape API Endpoint                      │
│                    (server.js:297)                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Check for Dedicated Scrapers                    │
│         (Zara, eBay, WConcept get priority)                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                Universal Parser V3 Attempt                   │
│              (If no dedicated scraper)                       │
│              Confidence threshold: 0.5                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
            Success (>0.5)      Failed (<0.5)
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌─────────────────┐
            │ Return V3    │   │ Legacy Scrapers │
            │ Result       │   │ (see below)     │
            └──────────────┘   └────────┬────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   detectSite(url)     │
                            └───────────┬───────────┘
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
                ▼                       ▼                       ▼
        FIRECRAWL_REQUIRED      Specific Site           No Match
             (REI)              Scrapers                     │
                │                   │                        │
                ▼                   ▼                        ▼
        ┌──────────────┐    ┌──────────────┐      ┌────────────────┐
        │  Firecrawl   │    │ Site-Specific│      │ Shopify Check  │
        │  Primary     │    │ Scrapers     │      │                │
        └──────────────┘    └──────────────┘      └───────┬────────┘
                                                           │
                                                   ┌───────┴────────┐
                                                   │                │
                                               Is Shopify?      Not Shopify
                                                   │                │
                                                   ▼                ▼
                                            ┌─────────────┐  ┌──────────┐
                                            │   Shopify   │  │ Generic  │
                                            │   Scraper   │  │ Scraper  │
                                            └─────────────┘  └──────────┘
```

## Detailed Flow by Site Type

### 1. FIRECRAWL_REQUIRED Sites (Primary Method)
**Sites:** `rei.com`

```
URL: rei.com/product/...
  ↓
detectSite() → Returns "firecrawl"
  ↓
FirecrawlParser.scrape(url)
  ↓
┌─ Success → Return product data
└─ Failure → Return error (no fallback for REI)
```

**Why:** REI has enterprise-grade bot detection. Firecrawl is the ONLY method that works reliably.

---

### 2. Site-Specific Scrapers with Firecrawl Fallback
**Sites:** `ssense.com`

```
URL: ssense.com/product/...
  ↓
detectSite() → Returns "ssense"
  ↓
Try: scrapeSsenseSimple(url) [Proxy-based]
  ↓
┌─ Success → Return product data
│
└─ Failure
     ↓
   Check: Is Firecrawl API key available?
     ↓
   ┌─ YES → Try FirecrawlParser.scrape(url)
   │          ↓
   │        ┌─ Success → Return product data
   │        └─ Failure → Use scrapeSsenseFallback(url)
   │
   └─ NO → Use scrapeSsenseFallback(url)
```

**Why:** Proxy scraper usually works for SSENSE. Firecrawl is backup if proxy fails.

---

### 3. Dedicated Scrapers (No Universal Parser)
**Sites:** `zara.com`, `ebay.com`, `wconcept.com`

```
URL: zara.com/product/...
  ↓
Server checks: useDedicatedScraper?
  ↓
YES → Skip Universal Parser V3
  ↓
detectSite() → Returns "zara"
  ↓
scrapeZara(url)
  ↓
Return product data
```

**Why:** These sites have custom scrapers that extract more data (like enhanced images for Zara).

---

### 4. Universal Parser V3 Sites
**Sites:** Most other e-commerce sites

```
URL: shopify-store.com/product/...
  ↓
Check: Is dedicated scraper? → NO
  ↓
Try: universalParser.parse(url)
  ↓
┌─ confidence > 0.5 → Return V3 result
│
└─ confidence ≤ 0.5 → Continue to legacy scrapers
     ↓
   detectSite() → Returns site type or "unknown"
     ↓
   Legacy scraper or Generic fallback
```

**Why:** Universal Parser handles most sites with AI-powered extraction.

---

### 5. Site-Specific Scrapers (Standard)
**Sites:** `amazon.com`, `etsy.com`, `nordstrom.com`, `farfetch.com`, etc.

```
URL: nordstrom.com/product/...
  ↓
detectSite() → Returns "nordstrom"
  ↓
scrapeNordstrom(url)
  ↓
Return product data
```

**Why:** These sites have known selectors and APIs.

---

### 6. Shopify Store Detection
**Sites:** Any Shopify-powered store

```
URL: unknown-store.com/product/...
  ↓
detectSite() → Returns "unknown"
  ↓
Check: isShopifyStore(url)?
  ↓
┌─ YES → scrapeShopify(url) → Return product data
│
└─ NO → Continue to generic scraper
```

**Why:** Shopify stores have standard JSON endpoints.

---

### 7. Generic Fallback
**Sites:** Any other e-commerce site

```
URL: random-store.com/product/...
  ↓
scrapeGeneric(url)
  ↓
Try common patterns (JSON-LD, meta tags, selectors)
  ↓
Return whatever data was extracted
```

**Why:** Last resort for unknown sites.

---

## Current Firecrawl Configuration

### Primary Method (Always Firecrawl)
```javascript
const FIRECRAWL_REQUIRED_SITES = [
  'rei.com'
];
```

### Fallback Method (Use after main scraper fails)
```javascript
const FIRECRAWL_FALLBACK_SITES = [
  'ssense.com'
];
```

---

## Adding Sites to Firecrawl

### To make Firecrawl the PRIMARY method:
```javascript
const FIRECRAWL_REQUIRED_SITES = [
  'rei.com',
  'nordstromrack.com',  // Add here for primary
  'bloomingdales.com'
];
```

### To make Firecrawl a FALLBACK:
```javascript
const FIRECRAWL_FALLBACK_SITES = [
  'ssense.com',
  'saksfifthavenue.com',  // Add here for fallback
  'netaporter.com'
];
```

Then add fallback logic in the site's case statement (like SSENSE example).

---

## Performance Optimization Order

The scraping methods are ordered by **speed and cost**:

1. **Direct API/JSON** (Fastest, Free)
   - Zara, Shopify stores
   - ~1-2 seconds

2. **Simple HTTP + Cheerio** (Fast, Free)
   - Amazon, Etsy, Nordstrom
   - ~2-4 seconds

3. **Proxy + Cheerio** (Medium, Low Cost)
   - SSENSE with proxy
   - ~5-10 seconds

4. **Puppeteer/Playwright** (Slow, Free)
   - Sites requiring JS rendering
   - ~10-20 seconds

5. **Firecrawl** (Medium, Paid)
   - REI, SSENSE fallback
   - ~10-30 seconds
   - Cost: $0.001-0.005 per scrape

6. **Universal Parser V3** (Medium, Free)
   - AI-powered extraction
   - ~5-15 seconds

---

## Error Handling Flow

```
Main Scraper
  ↓
┌─ Success → Return data
│
└─ Error
     ↓
   Firecrawl Fallback (if configured)
     ↓
   ┌─ Success → Return data
   │
   └─ Error
        ↓
      Basic Fallback (scrapeSsenseFallback, etc.)
        ↓
      ┌─ Success → Return partial data
      │
      └─ Error → Return error to user + Send Slack notification
```

---

## Monitoring & Metrics

All scraping attempts are tracked:
- `/enhancement-metrics` - Product enhancement stats
- `/api/parser/dashboard` - Universal Parser V3 performance
- Slack notifications on failures

---

## Summary

**Firecrawl is used for:**
1. ✅ **REI** - Primary method (always)
2. ✅ **SSENSE** - Fallback only (after proxy fails)
3. ✅ **Any site you add** to `FIRECRAWL_REQUIRED_SITES` or `FIRECRAWL_FALLBACK_SITES`

**Flow Priority:**
1. Dedicated scrapers (Zara, eBay, WConcept)
2. Universal Parser V3 (confidence > 0.5)
3. Firecrawl (if in REQUIRED list)
4. Site-specific scrapers (with Firecrawl fallback if configured)
5. Shopify detection
6. Generic scraper
