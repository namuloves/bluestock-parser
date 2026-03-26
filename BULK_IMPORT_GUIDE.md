# Collection Bulk Import Guide

This guide shows you how to bulk import products from collection pages (SSENSE and other storefronts).

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Integration with Your Database](#integration-with-your-database)
- [Examples](#examples)
- [Tips & Best Practices](#tips--best-practices)

---

## Quick Start

### 1. Test the Collection Parser

First, verify that the collection parser works:

```bash
node test-collection-parser.js
```

This will test URL detection and parse a sample collection page.

### 2. Run the Example Bulk Import

Run the example script to import 5 products:

```bash
node bulk-import-example.js
```

This will:
1. Parse the Our Legacy collection page
2. Extract product URLs
3. Scrape each product's details
4. Simulate saving to a database (you'll need to implement the actual save logic)

---

## How It Works

### Step 1: Parse Collection Page

The `parseCollectionPage()` function extracts product URLs from a collection page:

```javascript
const { parseCollectionPage } = require('./scrapers/collection-parser');

const productUrls = await parseCollectionPage('https://en.sessun.com/catalogue/early-days.html', {
  limit: 20,
  // Optional: help the parser on non-SSENSE stores
  // productLinkSelector: 'a.product-card',
  // productTileSelector: '.product-card',
  // productUrlPattern: /catalogue\/.*\.html/i
});

// Returns:
// [
//   'https://www.ssense.com/en-us/men/product/our-legacy/beige-sonar-round-neck-sweater/18101991',
//   'https://www.ssense.com/en-us/men/product/our-legacy/black-robe-coat/18103491',
//   ...
// ]
```

### Step 2: Scrape Each Product

Loop through the URLs and scrape each product:

```javascript
const { scrapeProduct } = require('./scrapers/index');

for (const url of productUrls) {
  const result = await scrapeProduct(url);

  if (result.success) {
    const product = result.product;
    // Save to database
    await saveToDatabase(product);
  }

  // Add delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 3000));
}
```

---

## API Reference

### `parseCollectionPage(url, options)`

Parses a collection page and extracts product URLs (SSENSE or other domains).

**Parameters:**
- `url` (string, required): The collection page URL
- `options` (object, optional):
  - `limit` (number): Max products to return (default: 20)
  - `scrollToLoad` (boolean): Scroll to trigger lazy loading (default: true)
  - `productLinkSelector` (string): CSS selector for product links (helps non-SSENSE layouts)
  - `productTileSelector` (string): CSS selector for product tiles/containers (parser will pull the first link inside)
  - `productUrlPattern` (RegExp | string): Pattern to recognize product detail URLs (e.g., `/catalogue/.*\\.html/i`)
  - `productPathMinDepth` (number): Minimum path depth to keep (e.g., `3` for `/catalogue/category/product.html`)
  - `rejectPatterns` (RegExp[] | string[]): Patterns to drop (e.g., category-only pages like `/catalogue/[^/]+\\.html/i`)
  - `sameHostOnly` (boolean): Keep only URLs on the same host (default: true)

**Returns:**
- `Promise<Array<string>>`: Array of product URLs

**Example:**
```javascript
const urls = await parseCollectionPage('https://www.ssense.com/en-us/men/sale', {
  limit: 50,
  scrollToLoad: true
});
```

### `isCollectionPage(url)`

Checks if a URL is a collection page (not a product detail page).

**Parameters:**
- `url` (string, required): The URL to check

**Returns:**
- `boolean`: True if it's a collection page

**Example:**
```javascript
const { isCollectionPage } = require('./scrapers/collection-parser');

isCollectionPage('https://www.ssense.com/en-us/men/designers/our-legacy'); // true
isCollectionPage('https://www.ssense.com/en-us/men/product/...'); // false
isCollectionPage('https://en.sessun.com/catalogue/early-days.html'); // true
```

---

## Integration with Your Database

Replace the `saveProductToDatabase()` function in `bulk-import-example.js` with your actual database logic.

### Example: Supabase

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function saveProductToDatabase(product) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.product_name,
      brand: product.brand,
      price: product.sale_price,
      original_price: product.original_price,
      is_on_sale: product.is_on_sale,
      discount_percentage: product.discount_percentage,
      images: product.image_urls,
      description: product.description,
      material: product.material,
      origin: product.origin,
      details: product.details,
      vendor_url: product.vendor_url,
      category: product.category,
      platform: product.platform,
      currency: product.currency,
      color: product.color
    });

  if (error) throw error;
  return data;
}
```

### Example: PostgreSQL

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function saveProductToDatabase(product) {
  const query = `
    INSERT INTO products (
      name, brand, price, original_price, is_on_sale,
      images, description, material, origin, details,
      vendor_url, category, platform, currency, color
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id
  `;

  const values = [
    product.product_name,
    product.brand,
    product.sale_price,
    product.original_price,
    product.is_on_sale,
    JSON.stringify(product.image_urls),
    product.description,
    product.material,
    product.origin,
    JSON.stringify(product.details),
    product.vendor_url,
    product.category,
    product.platform,
    product.currency,
    product.color
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}
```

---

## Examples

### Example 1: Import from a Designer Page

```javascript
const { bulkImportFromCollection } = require('./bulk-import-example');

bulkImportFromCollection('https://www.ssense.com/en-us/men/designers/yohji-yamamoto', {
  limit: 10,
  delayBetweenProducts: 3000,
  continueOnError: true
});
```

### Example 2: Import from Sale Section

```javascript
bulkImportFromCollection('https://www.ssense.com/en-us/men/sale', {
  limit: 50,
  delayBetweenProducts: 2000,
  continueOnError: true
});
```

### Example 3: Custom Import Script

```javascript
const { parseCollectionPage } = require('./scrapers/collection-parser');
const { scrapeProduct } = require('./scrapers/index');

async function customBulkImport() {
  // Get product URLs
  const urls = await parseCollectionPage(
    'https://www.ssense.com/en-us/women/clothing',
    {
      limit: 30,
      // productLinkSelector: 'a.product-card',
      // productTileSelector: '.product-card',
      // productPathMinDepth: 3,
      // rejectPatterns: [/\/catalogue\/[^/]+\.html/i]
    }
  );

  const results = [];

  for (const url of urls) {
    try {
      const result = await scrapeProduct(url);

      if (result.success && result.product) {
        // Custom filtering: Only save products under $500
        if (result.product.sale_price <= 500) {
          await saveToDatabase(result.product);
          results.push({ url, success: true });
        } else {
          console.log(`Skipped: ${result.product.product_name} - Too expensive`);
        }
      }
    } catch (error) {
      console.error(`Failed to process ${url}:`, error.message);
      results.push({ url, success: false, error: error.message });
    }

    // Delay between products
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return results;
}
```

---

## Tips & Best Practices

### 1. **Rate Limiting**

Always add delays between product scrapes to avoid getting blocked:

```javascript
// Recommended: 2-5 seconds between products
delayBetweenProducts: 3000
```

### 2. **Start Small**

Test with a small limit first (5-10 products) before scaling up:

```javascript
limit: 5  // Start small for testing
```

### 3. **Error Handling**

Enable `continueOnError` to keep going even if some products fail:

```javascript
continueOnError: true
```

### 4. **Duplicate Detection**

Check if a product already exists before saving:

```javascript
async function saveProductToDatabase(product) {
  // Check if product already exists
  const existing = await supabase
    .from('products')
    .select('id')
    .eq('vendor_url', product.vendor_url)
    .single();

  if (existing.data) {
    console.log('Product already exists, skipping');
    return existing.data;
  }

  // Save new product
  return await supabase.from('products').insert(product);
}
```

### 5. **Progress Tracking**

Log progress to track which products have been imported:

```javascript
console.log(`[${i + 1}/${totalProducts}] Processing: ${product.product_name}`);
```

### 6. **Supported Collection Page Types**

The parser works with these SSENSE page types:
- Designer pages: `/designers/our-legacy`
- Category pages: `/clothing`, `/shoes`, `/bags`
- Sale pages: `/sale`
- Search results: `/search`
- Gender landing pages: `/men`, `/women`

### 7. **Increase Limits Gradually**

If you need to import many products:
- Start with limit: 20
- If successful, increase to 50
- Then 100, 200, etc.
- Monitor for any blocking or errors

---

## Troubleshooting

### "No product URLs found"

- Verify the URL is a collection page, not a product page
- Check that the page loaded correctly
- Try increasing the scroll delay or enabling `scrollToLoad`

### "Rate limited / 403 errors"

- Increase `delayBetweenProducts` (try 5000ms or higher)
- Reduce the `limit` to scrape fewer products at once
- Run the import during off-peak hours

### "Products failing to scrape"

- Check the individual product URLs manually
- Some products might be sold out or removed
- Enable `continueOnError: true` to skip failed products

---

## Next Steps

1. **Customize the example script** with your database logic
2. **Test with a small collection** (5-10 products)
3. **Scale up gradually** as you verify everything works
4. **Set up scheduled imports** to keep your product catalog fresh

For questions or issues, check the main README or open an issue on GitHub.
