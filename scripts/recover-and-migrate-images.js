#!/usr/bin/env node

/**
 * Image Recovery and Migration Script
 *
 * This script:
 * 1. Fetches all products from the database that have Supabase image URLs
 * 2. Re-scrapes each product from the vendor URL to get fresh images
 * 3. Uploads images to Bunny CDN
 * 4. Updates the database with new Bunny CDN URLs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const BunnyStorageService = require('./services/bunny-storage');
const axios = require('axios');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const bunnyStorage = new BunnyStorageService();

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1]) || 10;
const PARSER_URL = process.env.PARSER_URL || 'https://bluestock-parser.up.railway.app';

console.log('🔧 Configuration:');
console.log(`   Dry Run: ${DRY_RUN ? 'Yes (no changes will be made)' : 'No (will update database)'}`);
console.log(`   Batch Size: ${BATCH_SIZE}`);
console.log(`   Parser URL: ${PARSER_URL}`);
console.log('');

/**
 * Check if a URL is from Supabase storage
 */
function isSupabaseImageUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage') ||
         url.includes('qkaeoxsttjahdziqcgsk.supabase.co');
}

/**
 * Get all products with Supabase image URLs
 */
async function getProductsWithSupabaseImages() {
  console.log('📊 Fetching products from database...');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, vendor_url, image_urls, product_name, brand')
    .not('vendor_url', 'is', null);

  if (error) {
    console.error('❌ Error fetching products:', error);
    throw error;
  }

  // Filter products that have Supabase image URLs
  const productsWithSupabaseImages = products.filter(product => {
    if (!product.image_urls || product.image_urls.length === 0) {
      return false;
    }

    // Check if any image URL is from Supabase
    return product.image_urls.some(url => isSupabaseImageUrl(url));
  });

  console.log(`✅ Found ${products.length} total products`);
  console.log(`🔍 ${productsWithSupabaseImages.length} products have Supabase image URLs`);

  return productsWithSupabaseImages;
}

/**
 * Re-scrape a product from the vendor URL
 */
async function rescrapeProduct(vendorUrl) {
  console.log(`   🌐 Re-scraping: ${vendorUrl}`);

  try {
    const response = await axios.post(`${PARSER_URL}/scrape`, {
      url: vendorUrl
    }, {
      timeout: 60000 // 60 second timeout
    });

    if (response.data.success && response.data.product) {
      const images = response.data.product.image_urls || response.data.product.images || [];
      console.log(`   ✅ Scraped ${images.length} images`);
      return {
        success: true,
        images: images,
        product: response.data.product
      };
    } else {
      console.log(`   ❌ Scraping failed: ${response.data.error || 'Unknown error'}`);
      return { success: false, error: response.data.error };
    }
  } catch (error) {
    console.log(`   ❌ Scraping error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Upload images to Bunny CDN
 */
async function uploadToBunnyCDN(imageUrls) {
  if (imageUrls.length === 0) {
    return [];
  }

  console.log(`   📤 Uploading ${imageUrls.length} images to Bunny CDN...`);

  try {
    const uploadResults = await bunnyStorage.uploadImages(imageUrls, {
      width: 720,
      quality: 85,
      format: 'auto'
    });

    const cdnUrls = uploadResults.map(result => result.cdn);
    console.log(`   ✅ Uploaded to Bunny CDN: ${cdnUrls.length} images`);
    return cdnUrls;
  } catch (error) {
    console.log(`   ❌ Upload error: ${error.message}`);
    return [];
  }
}

/**
 * Update product in database with new CDN URLs
 */
async function updateProductImages(productId, newImageUrls) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would update product ${productId} with ${newImageUrls.length} new URLs`);
    return true;
  }

  console.log(`   💾 Updating product ${productId} in database...`);

  const { error } = await supabase
    .from('products')
    .update({ image_urls: newImageUrls })
    .eq('id', productId);

  if (error) {
    console.log(`   ❌ Database update error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Database updated`);
  return true;
}

/**
 * Process a single product
 */
async function processProduct(product, index, total) {
  console.log(`\n[$${index + 1}/${total}] Processing: ${product.product_name || 'Unknown'}`);
  console.log(`   Brand: ${product.brand || 'Unknown'}`);
  console.log(`   Current images: ${product.image_urls?.length || 0}`);
  console.log(`   Vendor URL: ${product.vendor_url}`);

  // Check if images are already on Bunny CDN
  const allOnBunny = product.image_urls?.every(url =>
    url.includes('bluestock.b-cdn.net') || url.includes('.b-cdn.net')
  );

  if (allOnBunny) {
    console.log(`   ℹ️  Already using Bunny CDN - skipping`);
    return { status: 'skipped', reason: 'already_on_bunny' };
  }

  // Re-scrape the product
  const scrapeResult = await rescrapeProduct(product.vendor_url);

  if (!scrapeResult.success || !scrapeResult.images || scrapeResult.images.length === 0) {
    console.log(`   ⚠️  Could not re-scrape - keeping existing URLs`);
    return { status: 'failed', reason: 'scrape_failed', error: scrapeResult.error };
  }

  // Upload to Bunny CDN
  const cdnUrls = await uploadToBunnyCDN(scrapeResult.images);

  if (cdnUrls.length === 0) {
    console.log(`   ⚠️  Upload failed - keeping existing URLs`);
    return { status: 'failed', reason: 'upload_failed' };
  }

  // Update database
  const updated = await updateProductImages(product.id, cdnUrls);

  if (!updated) {
    return { status: 'failed', reason: 'db_update_failed' };
  }

  return {
    status: 'success',
    oldCount: product.image_urls?.length || 0,
    newCount: cdnUrls.length
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Image Recovery and Migration Tool\n');
  console.log('=' .repeat(70));

  try {
    // Get all products with Supabase images
    const products = await getProductsWithSupabaseImages();

    if (products.length === 0) {
      console.log('\n✅ No products found with Supabase image URLs');
      console.log('   All images may already be migrated to Bunny CDN');
      return;
    }

    console.log(`\n📋 Will process ${products.length} products in batches of ${BATCH_SIZE}`);
    console.log('=' .repeat(70));

    // Process products in batches
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`);

      for (let j = 0; j < batch.length; j++) {
        const product = batch[j];
        const result = await processProduct(product, i + j, products.length);

        if (result.status === 'success') {
          results.success++;
        } else if (result.status === 'skipped') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({
            product_id: product.id,
            product_name: product.product_name,
            reason: result.reason,
            error: result.error
          });
        }

        // Small delay between products to avoid overwhelming the parser
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Longer delay between batches
      if (i + BATCH_SIZE < products.length) {
        console.log('\n⏸️  Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Summary:');
    console.log('=' .repeat(70));
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Failed: ${results.failed}`);
    console.log(`ℹ️  Skipped: ${results.skipped}`);
    console.log(`📝 Total: ${products.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Failed Products:');
      results.errors.forEach(err => {
        console.log(`   - ${err.product_name} (${err.reason})`);
        if (err.error) console.log(`     Error: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log(DRY_RUN ? '🔍 DRY RUN COMPLETE - No changes were made' : '✅ MIGRATION COMPLETE');
    console.log('=' .repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processProduct, getProductsWithSupabaseImages };
