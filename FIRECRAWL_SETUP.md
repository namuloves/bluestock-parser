# Firecrawl Integration for Enterprise Bot Detection

## Overview

Firecrawl has been integrated into the Bluestock Parser to handle websites with enterprise-grade bot detection systems like:
- **SSENSE** - Fashion retailer with advanced protection
- **REI** - Outdoor retailer with bot detection
- Other protected e-commerce sites

## What is Firecrawl?

Firecrawl is a managed scraping service that bypasses bot detection using:
- Advanced browser fingerprinting evasion
- Residential proxy rotation
- Human-like behavior simulation
- CAPTCHA solving
- JavaScript rendering

## Setup

### 1. Get API Key

Sign up at [https://firecrawl.dev](https://firecrawl.dev) to get your API key.

### 2. Configure Environment

Add your Firecrawl API key to `.env`:

```bash
FIRECRAWL_API_KEY=fc-your-api-key-here
```

### 3. Installation

The package is already installed:

```bash
npm install @mendable/firecrawl-js
```

## Usage

### Automatic Mode

Sites configured to use Firecrawl will automatically use it when the API key is present:

```javascript
const { scrapeProduct } = require('./scrapers');

// SSENSE will automatically use Firecrawl if API key is set
const result = await scrapeProduct('https://www.ssense.com/...');
```

### Manual Mode

Use the FirecrawlParser directly:

```javascript
const FirecrawlParser = require('./scrapers/firecrawl-parser');

const parser = new FirecrawlParser();
const result = await parser.scrape(url, {
  timeout: 90000,  // 90 seconds
  waitFor: 5000    // Wait 5s for JS
});
```

## Configured Sites

Sites that use Firecrawl when API key is present:

- `rei.com` - Always uses Firecrawl
- `ssense.com` - Can use Firecrawl as alternative to proxy

To add more sites, edit `scrapers/index.js`:

```javascript
const FIRECRAWL_REQUIRED_SITES = [
  'rei.com',
  'ssense.com',
  'your-site.com'  // Add here
];
```

## Testing

### Test SSENSE
```bash
node test-firecrawl-ssense.js
```

### Test REI
```bash
node test-firecrawl-rei.js
```

### Test Generic Site
```bash
node test-firecrawl-simple.js
```

## How It Works

1. **Site Detection**: When a URL is scraped, the system checks if it matches a Firecrawl-required site
2. **Firecrawl Routing**: If matched AND API key is present, uses Firecrawl
3. **Fallback**: If Firecrawl fails or is not configured, falls back to existing scrapers (proxy/Puppeteer)
4. **Parsing**: Uses site-specific parsers (SSENSE, REI) or generic parser to extract product data

## Architecture

```
scrapers/
├── firecrawl-parser.js     # Main Firecrawl integration
├── index.js                # Router that decides when to use Firecrawl
└── [site].js               # Site-specific scrapers (fallback)
```

## Site-Specific Parsers

### SSENSE Parser
- Extracts from JSON-LD structured data
- Falls back to CSS selectors
- Handles designer/brand extraction

### REI Parser
- Parses JSON-LD for product data
- Handles sale prices vs regular prices
- Extracts outdoor-specific attributes

### Generic Parser
- Works with any e-commerce site
- Uses common patterns (JSON-LD, meta tags, h1)
- Suitable for most Shopify/WooCommerce sites

## Cost Considerations

Firecrawl is a paid service with these approximate costs:
- **Scrape**: ~$0.001-0.005 per page
- **Crawl**: ~$0.01-0.05 per site
- **Search**: ~$0.005-0.01 per query

**Recommendations**:
- Use Firecrawl only for sites that block other methods
- Cache results to avoid duplicate scrapes
- Monitor usage in Firecrawl dashboard

## Troubleshooting

### "Firecrawl API key not configured"
- Make sure `FIRECRAWL_API_KEY` is set in `.env`
- Restart your server after adding the key

### "Scrape timed out"
- Increase timeout: `parser.scrape(url, { timeout: 120000 })`
- Some complex sites may need longer

### "Failed to extract required product data"
- The site may use non-standard selectors
- Add a custom parser for that site in `firecrawl-parser.js`
- Check the `partial_data` to see what was extracted

### Missing product names
- Check if site redirected to search/404 page
- Verify URL is correct and product still exists
- Add site-specific selectors to parser

## Development

### Adding a New Site Parser

1. Add site detection in `parseProductData()`:

```javascript
parseProductData(html, markdown, url) {
  const $ = cheerio.load(html);
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('yoursite.com')) {
    return this.parseYourSite($, markdown, url);
  }
  // ...
}
```

2. Create site-specific parser method:

```javascript
parseYourSite($, markdown, url) {
  const product = {
    platform: 'yoursite',
    vendor_url: url
  };

  // Extract product data
  product.product_name = $('.your-title-selector').text().trim();
  product.brand = $('.your-brand-selector').text().trim();
  product.sale_price = this.parsePrice($('.price').text());

  // Extract images
  const images = [];
  $('.product-image img').each((i, el) => {
    images.push($(el).attr('src'));
  });
  product.image_urls = images;

  return product;
}
```

3. Add to required sites list in `scrapers/index.js`

## API Reference

### FirecrawlParser.scrape(url, options)

Scrapes a URL using Firecrawl.

**Parameters:**
- `url` (string): URL to scrape
- `options` (object):
  - `timeout` (number): Timeout in ms (default: 90000)
  - `waitFor` (number): Wait for JS in ms (default: 5000)

**Returns:**
```javascript
{
  success: boolean,
  product: {
    product_name: string,
    brand: string,
    sale_price: number,
    original_price: number,
    image_urls: string[],
    description: string,
    platform: string,
    vendor_url: string,
    scraped_at: string,
    scraper: 'firecrawl'
  },
  error: string  // if failed
}
```

## Support

- **Firecrawl Docs**: https://docs.firecrawl.dev
- **Firecrawl Dashboard**: https://firecrawl.dev/dashboard
- **Support**: support@firecrawl.dev
