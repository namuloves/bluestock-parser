#!/usr/bin/env node

/**
 * Posts Migration Script - Supabase to Bunny CDN
 * Migrates all post images from Supabase storage to Bunny CDN
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
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1]) || 5;

console.log('🔧 Configuration:');
console.log(`   Dry Run: ${DRY_RUN ? 'Yes (no changes will be made)' : 'No (will update database)'}`);
console.log(`   Batch Size: ${BATCH_SIZE}`);
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
 * Get all posts with Supabase image URLs
 */
async function getPostsWithSupabaseImages() {
  console.log('📊 Fetching posts from database...');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, source_url, image_urls, product_name, product_brand')
    .not('image_urls', 'is', null);

  if (error) {
    console.error('❌ Error fetching posts:', error);
    throw error;
  }

  // Filter posts that have Supabase image URLs
  const postsWithSupabaseImages = posts.filter(post => {
    if (!post.image_urls || post.image_urls.length === 0) {
      return false;
    }

    // Check if any image URL is from Supabase
    return post.image_urls.some(url => isSupabaseImageUrl(url));
  });

  console.log(`✅ Found ${posts.length} total posts`);
  console.log(`🔍 ${postsWithSupabaseImages.length} posts have Supabase image URLs`);

  return postsWithSupabaseImages;
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
 * Update post in database with new CDN URLs
 */
async function updatePostImages(postId, newImageUrls) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would update post ${postId} with ${newImageUrls.length} new URLs`);
    return true;
  }

  console.log(`   💾 Updating post ${postId} in database...`);

  const { error } = await supabase
    .from('posts')
    .update({ image_urls: newImageUrls })
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
  console.log(`   Source URL: ${post.source_url || 'No URL'}`);

  // Check if images are already on Bunny CDN
  const allOnBunny = post.image_urls?.every(url =>
    url.includes('bluestock.b-cdn.net') || url.includes('.b-cdn.net')
  );

  if (allOnBunny) {
    console.log(`   ℹ️  Already using Bunny CDN - skipping`);
    return { status: 'skipped', reason: 'already_on_bunny' };
  }

  // Filter out only Supabase URLs that need migration
  const supabaseUrls = post.image_urls.filter(url => isSupabaseImageUrl(url));

  if (supabaseUrls.length === 0) {
    console.log(`   ℹ️  No Supabase URLs to migrate`);
    return { status: 'skipped', reason: 'no_supabase_urls' };
  }

  console.log(`   🔄 Migrating ${supabaseUrls.length} Supabase images...`);

  // Upload to Bunny CDN
  const cdnUrls = await uploadToBunnyCDN(supabaseUrls);

  if (cdnUrls.length === 0) {
    console.log(`   ⚠️  Upload failed - keeping existing URLs`);
    return { status: 'failed', reason: 'upload_failed' };
  }

  // Combine new CDN URLs with any existing non-Supabase URLs
  const nonSupabaseUrls = post.image_urls.filter(url => !isSupabaseImageUrl(url));
  const finalUrls = [...cdnUrls, ...nonSupabaseUrls];

  // Update database
  const updated = await updatePostImages(post.id, finalUrls);

  if (!updated) {
    return { status: 'failed', reason: 'db_update_failed' };
  }

  return {
    status: 'success',
    oldCount: post.image_urls?.length || 0,
    newCount: finalUrls.length,
    migratedCount: cdnUrls.length
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Posts Image Migration Tool\n');
  console.log('=' .repeat(70));

  try {
    // Get all posts with Supabase images
    const posts = await getPostsWithSupabaseImages();

    if (posts.length === 0) {
      console.log('\n✅ No posts found with Supabase image URLs');
      console.log('   All post images may already be migrated to Bunny CDN');
      return;
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
          console.log(`   ✅ Successfully migrated ${result.migratedCount} images`);
        } else if (result.status === 'skipped') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({
            post_id: post.id,
            post_name: post.product_name,
            reason: result.reason,
            error: result.error
          });
        }

        // Small delay between posts to avoid overwhelming services
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Longer delay between batches
      if (i + BATCH_SIZE < posts.length) {
        console.log('\n⏸️  Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Summary:');
    console.log('=' .repeat(70));
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Failed: ${results.failed}`);
    console.log(`ℹ️  Skipped: ${results.skipped}`);
    console.log(`📝 Total: ${posts.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Failed Posts:');
      results.errors.forEach(err => {
        console.log(`   - ${err.post_name || 'Untitled'} (${err.reason})`);
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

module.exports = { processPost, getPostsWithSupabaseImages };