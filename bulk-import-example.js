/**
 * Example: Bulk Import Products from SSENSE Collection Page
 *
 * This script demonstrates how to:
 * 1. Parse a collection page to get product URLs
 * 2. Loop through each product and scrape its details
 * 3. Save products to your database
 *
 * Usage:
 *   node bulk-import-example.js
 */

const { parseCollectionPage } = require('./scrapers/collection-parser');
const { scrapeProduct } = require('./scrapers/index');

/**
 * Simulate saving a product to the database
 * Replace this with your actual database logic
 */
async function saveProductToDatabase(product) {
  // Example: Save to Supabase, PostgreSQL, MongoDB, etc.
  console.log('💾 Saving product to database:', product.product_name);

  // Your database save logic here:
  // await supabase.from('products').insert({
  //   name: product.product_name,
  //   brand: product.brand,
  //   price: product.sale_price,
  //   original_price: product.original_price,
  //   images: product.image_urls,
  //   description: product.description,
  //   material: product.material,
  //   origin: product.origin,
  //   details: product.details,
  //   vendor_url: product.vendor_url,
  //   category: product.category,
  //   platform: product.platform,
  //   currency: product.currency
  // });

  return true;
}

/**
 * Bulk import products from a collection page
 */
async function bulkImportFromCollection(collectionUrl, options = {}) {
  const {
    limit = 20,
    delayBetweenProducts = 2000, // 2 seconds delay to avoid rate limiting
    continueOnError = true // Continue even if one product fails
  } = options;

  console.log('🚀 Starting bulk import from:', collectionUrl);
  console.log('⚙️ Settings:', { limit, delayBetweenProducts, continueOnError });
  console.log('='.repeat(80));

  try {
    // Step 1: Parse collection page to get product URLs
    console.log('\n📋 Step 1: Extracting product URLs from collection page...\n');
    const productUrls = await parseCollectionPage(collectionUrl, {
      limit,
      // Uncomment and customize for non-SSENSE stores:
      // productLinkSelector: 'a.product-card', // e.g. a class that wraps each product link
      // productTileSelector: '.product-card',   // e.g. a tile/container selector
      // productUrlPattern: /catalogue\/[^/]+\/[^/]+\.html/i, // e.g. Sessun: category + product
      // productPathMinDepth: 3, // e.g. require /catalogue/category/product.html
      // rejectPatterns: [/\/catalogue\/[^/]+\.html/i], // e.g. drop category-level pages
    });

    if (!productUrls || productUrls.length === 0) {
      console.error('❌ No product URLs found on the collection page');
      return { success: false, imported: 0, failed: 0 };
    }

    console.log(`\n✅ Found ${productUrls.length} products to import\n`);
    console.log('='.repeat(80));

    // Step 2: Loop through each product URL and scrape it
    console.log('\n📦 Step 2: Scraping individual products...\n');

    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < productUrls.length; i++) {
      const productUrl = productUrls[i];
      console.log(`\n[${i + 1}/${productUrls.length}] Processing: ${productUrl}`);

      try {
        // Scrape the product
        const result = await scrapeProduct(productUrl);

        if (!result.success || !result.product) {
          throw new Error(result.error || 'Failed to scrape product');
        }

        const product = result.product;
        console.log(`  ✅ Scraped: ${product.brand} - ${product.product_name}`);
        console.log(`  💰 Price: ${product.currency} ${product.sale_price}`);

        // Save to database
        await saveProductToDatabase(product);
        console.log(`  💾 Saved to database`);

        results.success.push({
          url: productUrl,
          product: product.product_name
        });

      } catch (error) {
        console.error(`  ❌ Error processing product:`, error.message);
        results.failed.push({
          url: productUrl,
          error: error.message
        });

        if (!continueOnError) {
          throw error;
        }
      }

      // Add delay between products to avoid rate limiting
      if (i < productUrls.length - 1 && delayBetweenProducts > 0) {
        console.log(`  ⏳ Waiting ${delayBetweenProducts}ms before next product...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenProducts));
      }
    }

    // Step 3: Print summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 IMPORT SUMMARY\n');
    console.log(`✅ Successfully imported: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`📈 Success rate: ${((results.success.length / productUrls.length) * 100).toFixed(1)}%`);

    if (results.failed.length > 0) {
      console.log('\n❌ Failed products:');
      results.failed.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.url}`);
        console.log(`     Error: ${item.error}`);
      });
    }

    return {
      success: true,
      imported: results.success.length,
      failed: results.failed.length,
      results
    };

  } catch (error) {
    console.error('\n❌ Bulk import failed:', error.message);
    return {
      success: false,
      error: error.message,
      imported: 0,
      failed: 0
    };
  }
}

// Example usage
if (require.main === module) {
  // Collection URL to import from
  const collectionUrl = process.env.COLLECTION_URL || 'https://www.ssense.com/en-us/men/designers/our-legacy';

  // Run the bulk import
  bulkImportFromCollection(collectionUrl, {
    limit: 5, // Start with just 5 products for testing
    delayBetweenProducts: 3000, // 3 seconds between products
    continueOnError: true
  })
    .then(result => {
      console.log('\n✅ Bulk import completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Bulk import failed:', error);
      process.exit(1);
    });
}

module.exports = { bulkImportFromCollection };
