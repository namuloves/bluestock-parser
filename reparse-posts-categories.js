#!/usr/bin/env node

/**
 * Script to re-parse existing posts and update their categories
 * This will fetch all posts with source_url but no category and re-parse them
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Import the scraping function
const fetch = require('node-fetch');

async function parseUrl(url) {
  try {
    console.log(`  📍 Parsing: ${url}`);

    // Call the local parser API
    const response = await fetch('http://localhost:3001/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      console.log(`  ❌ Failed to parse: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success === false) {
      console.log(`  ❌ Parser returned error: ${data.error}`);
      return null;
    }

    // Return the category
    return data.category || null;
  } catch (error) {
    console.log(`  ❌ Error parsing URL: ${error.message}`);
    return null;
  }
}

async function reparsePostsCategories() {
  console.log('🚀 Starting to re-parse posts for categories...\n');

  // First, check if the parser server is running
  try {
    const healthCheck = await fetch('http://localhost:3001/health');
    if (!healthCheck.ok) {
      throw new Error('Parser server not responding');
    }
    console.log('✅ Parser server is running\n');
  } catch (error) {
    console.error('❌ Error: Parser server is not running!');
    console.error('Please start it with: npm run dev');
    process.exit(1);
  }

  // Fetch all posts that have a source_url but no category
  console.log('📋 Fetching posts that need category updates...');

  const { data: posts, error: fetchError } = await supabase
    .from('posts')
    .select('id, source_url, product_name, product_brand')
    .not('source_url', 'is', null)
    .is('product_category', null)
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
  let skippedCount = 0;

  for (const post of posts) {
    console.log(`\n🔄 Processing post ${post.id}`);
    console.log(`  Product: ${post.product_brand || 'Unknown'} - ${post.product_name || 'Unknown'}`);

    // Skip if no source URL
    if (!post.source_url) {
      console.log(`  ⏭️  Skipped: No source URL`);
      skippedCount++;
      continue;
    }

    // Parse the URL to get category
    const category = await parseUrl(post.source_url);

    if (!category) {
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
    }

    // Add a small delay to avoid overwhelming the parser
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 RE-PARSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Successfully updated: ${successCount} posts`);
  console.log(`❌ Failed to update: ${failureCount} posts`);
  console.log(`⏭️  Skipped: ${skippedCount} posts`);
  console.log(`📋 Total processed: ${posts.length} posts`);
  console.log('='.repeat(50) + '\n');
}

// Run the script
reparsePostsCategories()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });