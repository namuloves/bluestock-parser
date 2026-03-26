# Quick Start: SSENSE Bulk Import

Import multiple products from SSENSE collection pages in 3 simple steps.

## Step 1: Parse Collection Page

Extract product URLs from any collection page (SSENSE or other stores):

```javascript
const { parseCollectionPage } = require('./scrapers/collection-parser');

const urls = await parseCollectionPage(
  'https://en.sessun.com/catalogue/early-days.html',
  {
    limit: 20,
    // Optional helpers for non-SSENSE stores:
    // productLinkSelector: 'a.product-card',
    // productTileSelector: '.product-card',
    // productUrlPattern: /catalogue\/[^/]+\/[^/]+\.html/i,
    // productPathMinDepth: 3, // require /catalogue/category/product.html
    // rejectPatterns: [/\/catalogue\/[^/]+\.html/i] // drop category-level pages
  }
);

console.log(`Found ${urls.length} products`);
```

## Step 2: Scrape Each Product

Loop through URLs and scrape product details:

```javascript
const { scrapeProduct } = require('./scrapers/index');

for (const url of urls) {
  const result = await scrapeProduct(url);

  if (result.success) {
    console.log('Scraped:', result.product.product_name);
    // Process the product...
  }

  // Wait 3 seconds before next product (avoid rate limits)
  await new Promise(resolve => setTimeout(resolve, 3000));
}
```

## Step 3: Save to Your Database

Implement your database save logic:

```javascript
async function saveProductToDatabase(product) {
  // Example with Supabase
  await supabase.from('products').insert({
    name: product.product_name,
    brand: product.brand,
    price: product.sale_price,
    original_price: product.original_price,
    images: product.image_urls,
    description: product.description,
    material: product.material,
    origin: product.origin,
    details: product.details,
    vendor_url: product.vendor_url,
    category: product.category,
    platform: product.platform
  });
}
```

## Complete Example

See `bulk-import-example.js` for a full working example:

```bash
node bulk-import-example.js
```

## Supported Collection URLs

- **Designer pages**: `https://www.ssense.com/en-us/men/designers/our-legacy`
- **Categories**: `https://www.ssense.com/en-us/women/clothing`
- **Sale**: `https://www.ssense.com/en-us/men/sale`
- **Search**: `https://www.ssense.com/en-us/search/...`

## Product Data Structure

Each scraped product includes:

```javascript
{
  product_name: "Vampire Fang Pinkie Ring",
  brand: "YOHJI YAMAMOTO",
  sale_price: 326,
  original_price: 326,
  is_on_sale: false,
  discount_percentage: null,
  image_urls: ["https://..."],
  vendor_url: "https://www.ssense.com/...",
  description: "Pinkie ring in sterling silver...",
  color: "",
  category: "Jewelry",
  material: "950 sterling silver",
  origin: "Japan",
  details: [
    "Pinkie ring in sterling silver.",
    "Graphic and cutout at face",
    "Logo engraved at inner band"
  ],
  platform: "ssense",
  currency: "USD"
}
```

## Important Notes

- ✅ Add 2-5 second delays between products to avoid rate limits
- ✅ Start with small limits (5-10 products) for testing
- ✅ Use `continueOnError: true` to handle failures gracefully
- ✅ Check for duplicate products before saving

For detailed documentation, see [BULK_IMPORT_GUIDE.md](./BULK_IMPORT_GUIDE.md)
