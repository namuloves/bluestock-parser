#!/usr/bin/env node

/**
 * Direct script to update post categories using the category detection logic
 * This doesn't require the parser server to be running
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { detectCategory } = require('./utils/enhancedCategoryDetection');
const { detectCategory: simpleDetect } = require('./utils/categoryDetection');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updatePostsCategories() {
  console.log('🚀 Starting to update post categories directly...\n');

  // Fetch all posts that have product info but no category
  console.log('📋 Fetching posts that need category updates...');

  const { data: posts, error: fetchError } = await supabase
    .from('posts')
    .select('id, source_url, product_name, product_brand')
    .is('product_category', null)
    .not('product_name', 'is', null)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching posts:', fetchError);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('✨ No posts need category updates!');
    return;
  }

  console.log(`📊 Found ${posts.length} posts to update\n`);

  // Process each post
  let successCount = 0;
  let failureCount = 0;
  const categoryStats = {};

  for (const post of posts) {
    console.log(`\n🔄 Processing post ${post.id}`);
    console.log(`  Product: ${post.product_brand || 'Unknown'} - ${post.product_name || 'Unknown'}`);

    // Use enhanced detection first
    let category = detectCategory({
      productName: post.product_name || '',
      description: '',
      brand: post.product_brand || '',
      scrapedCategory: '',
      breadcrumbs: [],
      url: post.source_url || '',
      metaTags: {},
      structuredData: {}
    });

    // Fallback to simple detection if enhanced returns 'Other'
    if (!category || category === 'Other') {
      category = simpleDetect(
        post.product_name || '',
        '',
        post.product_brand || '',
        ''
      );
    }

    if (!category || category === 'Other') {
      console.log(`  ⏭️  Skipped: Could not determine category`);
      failureCount++;
      continue;
    }

    // Update the post with the category
    const { error: updateError } = await supabase
      .from('posts')
      .update({ product_category: category })
      .eq('id', post.id);

    if (updateError) {
      console.log(`  ❌ Failed to update: ${updateError.message}`);
      failureCount++;
    } else {
      console.log(`  ✅ Updated with category: ${category}`);
      successCount++;

      // Track category statistics
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 CATEGORY UPDATE COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Successfully updated: ${successCount} posts`);
  console.log(`❌ Failed/Skipped: ${failureCount} posts`);
  console.log(`📋 Total processed: ${posts.length} posts`);

  if (Object.keys(categoryStats).length > 0) {
    console.log('\n📈 Categories assigned:');
    for (const [category, count] of Object.entries(categoryStats)) {
      console.log(`  • ${category}: ${count} posts`);
    }
  }

  console.log('='.repeat(50) + '\n');
}

// Run the script
updatePostsCategories()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });