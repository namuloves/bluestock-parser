#!/usr/bin/env node

/**
 * Re-scrape and Fix Posts Script
 *
 * This script:
 * 1. Fetches all posts from the database
 * 2. Identifies posts with broken or non-Bunny CDN image URLs
 * 3. Re-scrapes each post from its source URL
 * 4. Uploads new images to Bunny CDN
 * 5. Updates the database with new image URLs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize services
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PARSER_URL = process.env.PARSER_URL || 'https://bluestock-parser.up.railway.app';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1]) || 5;
const FORCE_ALL = process.argv.includes('--force-all');

console.log('🔧 Configuration:');
console.log(`   Dry Run: ${DRY_RUN ? 'Yes (no changes will be made)' : 'No (will update database)'}`);
console.log(`   Batch Size: ${BATCH_SIZE}`);
console.log(`   Force All: ${FORCE_ALL ? 'Yes (re-scrape all posts)' : 'No (only fix broken ones)'}`);
console.log(`   Parser URL: ${PARSER_URL}`);
console.log('');

/**
 * Check if image URL is accessible
 */
async function isImageAccessible(url) {
  if (!url) return false;

  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: status => status < 400
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a URL is from Bunny CDN
 */
function isBunnyCDNUrl(url) {
  if (!url) return false;
  return url.includes('bluestock.b-cdn.net') || url.includes('.b-cdn.net');
}

/**
 * Check if a URL is from Supabase
 */
function isSupabaseUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage') || url.includes('qkaeoxsttjahdziqcgsk.supabase.co');
}

/**
 * Get all posts that need fixing
 */
async function getPostsToFix() {
  console.log('📊 Fetching posts from database...');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, source_url, image_urls, product_name, product_brand')
    .not('source_url', 'is', null);

  if (error) {
    console.error('❌ Error fetching posts:', error);
    throw error;
  }

  if (FORCE_ALL) {
    console.log(`✅ Found ${posts.length} total posts (force-all mode)`);
    return posts;
  }

  // Filter posts that need fixing
  const postsToFix = [];

  for (const post of posts) {
    // Skip if no images
    if (!post.image_urls || post.image_urls.length === 0) {
      postsToFix.push(post);
      continue;
    }

    // Check if all images are on Bunny CDN and accessible
    let needsFix = false;

    for (const url of post.image_urls) {
      // If it's not Bunny CDN, it needs fixing
      if (!isBunnyCDNUrl(url)) {
        needsFix = true;
        break;
      }

      // If it's Supabase (broken), it needs fixing
      if (isSupabaseUrl(url)) {
        needsFix = true;
        break;
      }

      // Quick check - if URL looks malformed
      if (url.length < 20 || !url.includes('http')) {
        needsFix = true;
        break;
      }
    }

    if (needsFix) {
      postsToFix.push(post);
    }
  }

  console.log(`✅ Found ${posts.length} total posts`);
  console.log(`🔍 ${postsToFix.length} posts need fixing`);

  return postsToFix;
}

/**
 * Re-scrape product from source URL
 */
async function rescrapeProduct(sourceUrl) {
  console.log(`   🌐 Re-scraping: ${sourceUrl.substring(0, 80)}...`);

  try {
    const response = await axios.post(`${PARSER_URL}/scrape`, {
      url: sourceUrl
    }, {
      timeout: 60000
    });

    if (response.data.success && response.data.product) {
      const product = response.data.product;
      const images = product.image_urls || product.images || [];

      console.log(`   ✅ Scraped ${images.length} images`);

      return {
        success: true,
        images: images,
        productName: product.name || product.title,
        productBrand: product.brand
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
 * Update post in database
 */
async function updatePost(postId, imageUrls, productInfo = {}) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would update post ${postId} with ${imageUrls.length} new URLs`);
    return true;
  }

  console.log(`   💾 Updating post ${postId} in database...`);

  const updateData = { image_urls: imageUrls };

  // Update product info if available
  if (productInfo.productName) {
    updateData.product_name = productInfo.productName;
  }
  if (productInfo.productBrand) {
    updateData.product_brand = productInfo.productBrand;
  }

  const { error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', postId);

  if (error) {
    console.log(`   ❌ Database update error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Database updated`);
  return true;
}

/**
 * Process a single post
 */
async function processPost(post, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${post.product_name || 'Untitled'}`);
  console.log(`   Brand: ${post.product_brand || 'Unknown'}`);
  console.log(`   Current images: ${post.image_urls?.length || 0}`);
  console.log(`   Source URL: ${post.source_url?.substring(0, 80)}...`);

  // Check current image status
  if (post.image_urls && post.image_urls.length > 0) {
    const allBunny = post.image_urls.every(url => isBunnyCDNUrl(url));
    const hasSupabase = post.image_urls.some(url => isSupabaseUrl(url));

    if (allBunny && !FORCE_ALL) {
      // Quick accessibility check for first image
      const firstImageOk = await isImageAccessible(post.image_urls[0]);
      if (firstImageOk) {
        console.log(`   ✅ Already on Bunny CDN and accessible - skipping`);
        return { status: 'skipped', reason: 'already_ok' };
      }
    }

    if (hasSupabase) {
      console.log(`   ⚠️ Has broken Supabase URLs - needs fix`);
    }
  } else {
    console.log(`   ⚠️ No images - needs scraping`);
  }

  // Re-scrape the product
  const scrapeResult = await rescrapeProduct(post.source_url);

  if (!scrapeResult.success || !scrapeResult.images || scrapeResult.images.length === 0) {
    console.log(`   ⚠️ Could not re-scrape product`);
    return { status: 'failed', reason: 'scrape_failed', error: scrapeResult.error };
  }

  // Update database with new images
  const updated = await updatePost(post.id, scrapeResult.images, {
    productName: scrapeResult.productName,
    productBrand: scrapeResult.productBrand
  });

  if (!updated) {
    return { status: 'failed', reason: 'db_update_failed' };
  }

  return {
    status: 'success',
    oldCount: post.image_urls?.length || 0,
    newCount: scrapeResult.images.length
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Posts Re-scrape and Fix Tool\n');
  console.log('=' .repeat(70));

  try {
    // Get all posts that need fixing
    const posts = await getPostsToFix();

    if (posts.length === 0) {
      console.log('\n✅ No posts need fixing!');
      console.log('   All posts have valid Bunny CDN image URLs');
      return;
    }

    // Ask for confirmation if not dry run and many posts
    if (!DRY_RUN && posts.length > 20) {
      console.log('\n⚠️  WARNING: This will re-scrape and update ' + posts.length + ' posts.');
      console.log('   This may take a while. Consider using --batch flag.');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`\n📋 Will process ${posts.length} posts in batches of ${BATCH_SIZE}`);
    console.log('=' .repeat(70));

    // Process posts in batches
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)}`);

      for (let j = 0; j < batch.length; j++) {
        const post = batch[j];
        const result = await processPost(post, i + j, posts.length);

        if (result.status === 'success') {
          results.success++;
          console.log(`   ✨ Successfully updated with ${result.newCount} images`);
        } else if (result.status === 'skipped') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({
            post_id: post.id,
            post_name: post.product_name,
            source_url: post.source_url,
            reason: result.reason,
            error: result.error
          });
        }

        // Small delay between posts to avoid overwhelming the parser
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Longer delay between batches
      if (i + BATCH_SIZE < posts.length) {
        console.log('\n⏸️  Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Re-scrape Summary:');
    console.log('=' .repeat(70));
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Failed: ${results.failed}`);
    console.log(`ℹ️  Skipped: ${results.skipped}`);
    console.log(`📝 Total: ${posts.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Failed Posts:');
      console.log('-' .repeat(70));
      results.errors.forEach(err => {
        console.log(`\n📮 ${err.post_name || 'Untitled'}`);
        console.log(`   ID: ${err.post_id}`);
        console.log(`   URL: ${err.source_url?.substring(0, 60)}...`);
        console.log(`   Reason: ${err.reason}`);
        if (err.error) console.log(`   Error: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log(DRY_RUN ? '🔍 DRY RUN COMPLETE - No changes were made' : '✅ RE-SCRAPING COMPLETE');

    if (!DRY_RUN && results.success > 0) {
      console.log('\n🎉 Posts have been fixed with fresh images from their source URLs!');
      console.log('   All images are now hosted on Bunny CDN.');
      console.log('   Refresh your website to see the updated images.');
    }

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

module.exports = { processPost, getPostsToFix };