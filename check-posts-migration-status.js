#!/usr/bin/env node

/**
 * Check Migration Status for Posts Table
 * Check how many posts still have Supabase image URLs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isSupabaseImageUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage') || url.includes('qkaeoxsttjahdziqcgsk.supabase.co');
}

function isBunnyCDNUrl(url) {
  if (!url) return false;
  return url.includes('bluestock.b-cdn.net') || url.includes('.b-cdn.net');
}

async function main() {
  console.log('📊 Posts Migration Status Check\n');
  console.log('=' .repeat(60));

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, product_name, product_brand, image_urls, source_url')
    .not('image_urls', 'is', null);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  let supabaseCount = 0;
  let bunnyCount = 0;
  let mixedCount = 0;
  let otherCount = 0;
  let noImagesCount = 0;

  const supabasePosts = [];

  posts.forEach(post => {
    if (!post.image_urls || post.image_urls.length === 0) {
      noImagesCount++;
      return;
    }

    const hasSupabase = post.image_urls.some(url => isSupabaseImageUrl(url));
    const hasBunny = post.image_urls.some(url => isBunnyCDNUrl(url));

    if (hasSupabase && hasBunny) {
      mixedCount++;
      supabasePosts.push(post);
    } else if (hasSupabase) {
      supabaseCount++;
      supabasePosts.push(post);
    } else if (hasBunny) {
      bunnyCount++;
    } else {
      otherCount++;
    }
  });

  console.log(`📮 Total Posts: ${posts.length}`);
  console.log(`✅ Migrated to Bunny CDN: ${bunnyCount}`);
  console.log(`⚠️  Still on Supabase: ${supabaseCount}`);
  console.log(`🔄 Mixed (both): ${mixedCount}`);
  console.log(`📁 Other sources: ${otherCount}`);
  console.log(`🚫 No images: ${noImagesCount}`);
  console.log('');

  if (supabaseCount > 0 || mixedCount > 0) {
    console.log('=' .repeat(60));
    console.log(`\n⚠️  ${supabaseCount + mixedCount} posts need migration!\n`);

    // Show sample posts that need migration
    console.log('Sample posts with Supabase URLs:');
    console.log('-' .repeat(60));

    supabasePosts.slice(0, 5).forEach(post => {
      console.log(`\n📮 ${post.product_name || 'Untitled'} (${post.product_brand || 'No brand'})`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Source URL: ${post.source_url || 'No URL'}`);
      console.log(`   Images: ${post.image_urls.length}`);
      console.log(`   Sample URL: ${post.image_urls[0]?.substring(0, 80)}...`);
    });

    if (supabasePosts.length > 5) {
      console.log(`\n... and ${supabasePosts.length - 5} more posts`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📋 Next step: Run the posts migration script');
    console.log('   node migrate-posts-to-bunny.js');
  } else {
    console.log('🎉 All posts already migrated to Bunny CDN!');
  }

  console.log('=' .repeat(60));
}

main().catch(console.error);