#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PARSER_URL = 'https://bluestock-parser.up.railway.app';

async function findPostByName(productName) {
  console.log(`🔍 Searching for product: "${productName}"\n`);

  const { data, error } = await supabase
    .from('posts')
    .select('id, product_name, product_brand, source_url, image_urls')
    .ilike('product_name', `%${productName}%`)
    .limit(10);

  if (error) {
    console.error('❌ Search error:', error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('❌ No posts found matching that name');
    return null;
  }

  if (data.length === 1) {
    return data[0];
  }

  // Multiple matches
  console.log(`Found ${data.length} matching posts:\n`);
  data.forEach((post, i) => {
    console.log(`[${i + 1}] ${post.product_name}`);
    console.log(`    Brand: ${post.product_brand || 'Unknown'}`);
    console.log(`    Images: ${post.image_urls?.length || 0}`);
    console.log(`    URL: ${post.source_url?.substring(0, 60)}...`);
    console.log('');
  });

  console.log('⚠️  Multiple matches found. Please be more specific or use the source URL.');
  return null;
}

async function rescrapeAndUpdate(post, sourceUrl = null) {
  const urlToScrape = sourceUrl || post.source_url;

  console.log('📦 Post Details:');
  console.log(`   Name: ${post.product_name}`);
  console.log(`   Brand: ${post.product_brand || 'Unknown'}`);
  console.log(`   Current images: ${post.image_urls?.length || 0}`);
  console.log(`   Source URL: ${urlToScrape}\n`);

  // Show current images
  if (post.image_urls && post.image_urls.length > 0) {
    console.log('Current image URLs:');
    post.image_urls.forEach((url, i) => {
      const isBunny = url.includes('b-cdn.net');
      const isSupabase = url.includes('supabase.co');
      const isBroken = url.length < 50 || !url.includes('http');
      const status = isBunny ? '✅' : (isSupabase || isBroken ? '❌' : '⚠️');
      console.log(`  ${status} [${i}] ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
    });
    console.log('');
  }

  // Scrape
  console.log('🌐 Re-scraping product...');
  try {
    const response = await axios.post(`${PARSER_URL}/scrape`, {
      url: urlToScrape
    }, {
      timeout: 60000
    });

    if (!response.data.success) {
      console.error('❌ Scraping failed:', response.data.error);
      return false;
    }

    const images = response.data.product.image_urls || [];
    console.log(`✅ Scraped ${images.length} new images\n`);

    if (images.length === 0) {
      console.error('❌ No images found in scrape result');
      return false;
    }

    console.log('New image URLs:');
    images.forEach((url, i) => {
      console.log(`  [${i}] ${url}`);
    });

    // Update database
    console.log('\n💾 Updating database...');
    const { error } = await supabase
      .from('posts')
      .update({
        image_urls: images,
        source_url: urlToScrape // Update source URL to clean version
      })
      .eq('id', post.id);

    if (error) {
      console.error('❌ Database update failed:', error);
      return false;
    }

    console.log('✅ Database updated successfully!\n');

    // Verify
    const { data: verifyData } = await supabase
      .from('posts')
      .select('image_urls')
      .eq('id', post.id)
      .single();

    console.log('✅ VERIFIED - Current state in database:');
    verifyData.image_urls.forEach((url, i) => {
      console.log(`  [${i}] ${url}`);
    });

    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node fix-single-post.js "product name"');
    console.log('  node fix-single-post.js --url https://example.com/product');
    console.log('  node fix-single-post.js --id <post-id>');
    console.log('  node fix-single-post.js --name "product name" --url https://example.com/product');
    process.exit(1);
  }

  let post = null;
  let customUrl = null;

  // Parse arguments
  if (args[0] === '--url') {
    customUrl = args[1];
    console.log('❌ Need post ID or name when using --url');
    console.log('Usage: node fix-single-post.js --name "product" --url https://...');
    process.exit(1);
  } else if (args[0] === '--id') {
    const postId = args[1];
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    post = data;
  } else if (args[0] === '--name') {
    const productName = args[1];
    post = await findPostByName(productName);

    // Check for custom URL
    if (args[2] === '--url') {
      customUrl = args[3];
    }
  } else {
    // Assume it's a product name search
    const productName = args.join(' ');
    post = await findPostByName(productName);
  }

  if (!post) {
    process.exit(1);
  }

  console.log('━'.repeat(70));
  const success = await rescrapeAndUpdate(post, customUrl);
  console.log('━'.repeat(70));

  if (success) {
    console.log('\n✅ POST FIXED SUCCESSFULLY!\n');
  } else {
    console.log('\n❌ Failed to fix post\n');
    process.exit(1);
  }
}

main().catch(console.error);
