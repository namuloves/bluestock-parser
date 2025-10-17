# Critical Lessons Learned - Bluestock Parser

## 2025-01-16: The Arket Scraper Fuckup

### What Happened
User reported Arket URL timing out after 30 seconds. I immediately jumped to creating a dedicated Arket scraper without testing if the site was even accessible via HTTP.

### The Mistake
**I built a solution without verifying the root cause.**

Logs showed:
```
🏷️ Detected site: null
❌ No specific scraper available for this site
⏱️ Request timeout after 30 seconds
```

I saw "site not detected" and assumed:
1. Add Arket to `detectSite()` ✗
2. Create dedicated Arket scraper ✗
3. Implement auto-discovery system ✗ (good feature, wrong timing)

**What I SHOULD have done FIRST:**
```bash
curl -I https://www.arket.com/en-nl/product/...
# Returns: 403 Forbidden
```

Arket blocks simple HTTP requests. A dedicated scraper would NEVER work. The correct solution was to let it fall through to Universal Parser (which uses Firecrawl/Puppeteer for JS rendering).

### Root Cause
I made assumptions instead of testing:
- ✗ Assumed site was accessible via HTTP
- ✗ Assumed the problem was missing site detection
- ✗ Assumed a dedicated scraper was the solution

### What I Wasted
- 45 minutes of implementation time
- 280 lines of scraper code that couldn't work
- User's time deploying and testing broken code
- User's patience and trust

### The Correct Approach

**ALWAYS test these FIRST before writing code:**

1. **Can we access the site?**
   ```bash
   curl -I <url>
   # Check: 200 OK, 403 Forbidden, 503, etc.
   ```

2. **Does it need JavaScript rendering?**
   ```bash
   curl -s <url> | grep -i "javascript"
   # Check if content requires JS
   ```

3. **THEN decide the approach:**
   - ✓ 200 OK + static content → Dedicated scraper
   - ✓ 403 Forbidden → Universal Parser (Firecrawl/Puppeteer)
   - ✓ Needs JS rendering → Universal Parser
   - ✓ Known e-commerce platform (Shopify, etc.) → Platform scraper

### The Rule

**"Test don't assume" - Always verify the basics BEFORE implementing solutions.**

- Can we connect to the site?
- What does the raw response look like?
- Does it require special handling?

**Only AFTER answering these questions should I write code.**

### Sites That Require Special Handling

Keep this list updated with sites that CANNOT use simple HTTP scrapers:

- **Arket** (arket.com) - 403 Forbidden, needs JS rendering
- **SSENSE** (ssense.com) - Heavy JS, use dedicated scraper or Universal Parser
- **Zara** (zara.com) - Cloudflare protection
- **Net-A-Porter** (net-a-porter.com) - Bot detection
- **Farfetch** (farfetch.com) - Needs Puppeteer fallback

Add to this list whenever we discover a new site that blocks scrapers.

---

**Date:** 2025-01-16
**Impact:** High - Wasted time, broke user trust
**Status:** FIXED - Removed broken Arket scraper, now uses Universal Parser fallback
**Commit:** b82b754
