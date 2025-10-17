# Image Recovery Instructions

## What Happened

Images were deleted from Supabase before confirming they were migrated to Bunny CDN. The good news: **we can recover them by re-scraping from the original vendor websites**.

## Recovery Strategy

The `recover-and-migrate-images.js` script will:

1. ✅ Find all products in your database with Supabase image URLs
2. ✅ Re-scrape each product from the original vendor URL
3. ✅ Upload the images to Bunny CDN
4. ✅ Update your database with the new Bunny CDN URLs

---

## Step 1: Test Run (Dry Run)

First, run a dry run to see what will happen WITHOUT making any changes:

```bash
cd /Users/namu_1/bluestock-parser
node recover-and-migrate-images.js --dry-run
```

This will show you:
- How many products need migration
- Which products will be processed
- What URLs will be updated
- **NO changes will be made to your database**

---

## Step 2: Test on Small Batch

Test on just 5 products to make sure everything works:

```bash
node recover-and-migrate-images.js --batch=5
```

This will:
- Process the first 5 products
- Actually update your database
- Upload images to Bunny CDN
- Let you verify it's working correctly

**Check your database after this to verify the images are working!**

---

## Step 3: Run Full Migration

Once you've verified Step 2 works, run the full migration:

```bash
node recover-and-migrate-images.js --batch=10
```

This will:
- Process ALL products with Supabase image URLs
- Work in batches of 10 to avoid overwhelming the parser
- Update your entire database with Bunny CDN URLs

**This may take a while depending on how many products you have.**

---

## Options

### `--dry-run`
Run without making any changes (for testing)

### `--batch=N`
Process N products at a time (default: 10)
- Lower number = slower but safer
- Higher number = faster but more load on parser

### Examples:
```bash
# See what will happen without making changes
node recover-and-migrate-images.js --dry-run

# Process 5 products at a time
node recover-and-migrate-images.js --batch=5

# Process 20 products at a time (faster)
node recover-and-migrate-images.js --batch=20
```

---

## What to Expect

The script will show you:

```
🚀 Image Recovery and Migration Tool

📊 Fetching products from database...
✅ Found 150 total products
🔍 47 products have Supabase image URLs

📋 Will process 47 products in batches of 10

[1/47] Processing: Cotton Sweater Dress
   Brand: Blair
   Current images: 8
   Vendor URL: https://example.com/product/123
   🌐 Re-scraping: https://example.com/product/123
   ✅ Scraped 8 images
   📤 Uploading 8 images to Bunny CDN...
   ✅ Uploaded to Bunny CDN: 8 images
   💾 Updating product in database...
   ✅ Database updated
```

At the end, you'll see a summary:
```
📊 Migration Summary:
✅ Success: 45
⚠️  Failed: 2
ℹ️  Skipped: 0
📝 Total: 47
```

---

## Troubleshooting

### "Parser URL connection refused"
Make sure your parser is running:
```bash
npm start
```

Or set the parser URL if it's on Railway:
```bash
PARSER_URL=https://bluestock-parser.up.railway.app node recover-and-migrate-images.js
```

### "Scraping failed for product"
Some vendor websites may have changed or removed the product. These will be logged as failed, but the script will continue.

### "Upload to Bunny CDN failed"
Check your Bunny CDN credentials in `.env`:
- `BUNNY_STORAGE_API_KEY`
- `BUNNY_STORAGE_ZONE`

### Script is too slow
Increase the batch size:
```bash
node recover-and-migrate-images.js --batch=20
```

---

## Monitoring Progress

The script shows progress for each product:
- ✅ = Success
- ⚠️  = Warning/Failed
- ℹ️  = Information/Skipped

You can also check Bunny CDN dashboard to see images being uploaded in real-time.

---

## After Migration

Once complete:

1. **Verify in your app** - Check that product images are loading
2. **Check Bunny CDN dashboard** - Confirm images are uploaded
3. **Check database** - Image URLs should now point to `bluestock.b-cdn.net`

---

## Safety Features

- ✅ Skips products already using Bunny CDN
- ✅ Keeps original URLs if re-scraping fails
- ✅ Processes in batches to avoid overwhelming the parser
- ✅ Dry run mode for testing
- ✅ Detailed logging for every step
- ✅ Error handling and retry logic

---

## Need Help?

If you encounter issues:

1. Run with `--dry-run` first to diagnose
2. Check the error messages in the output
3. Verify your `.env` file has all required credentials
4. Make sure the parser is running (`npm start`)

---

## Estimated Time

- **Dry run**: ~30 seconds
- **5 products**: ~2-3 minutes
- **50 products**: ~20-30 minutes
- **100+ products**: 1+ hour

Time depends on:
- Number of products
- Number of images per product
- Vendor website response time
- Your internet connection speed
