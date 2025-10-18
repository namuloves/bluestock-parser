#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PARSER_URL = 'https://bluestock-parser.up.railway.app';

const URLS = [
  'https://af-agger.com/collections/outerwear/products/water-resistant-coat',
  'https://golflefleur.com/collections/apparel/products/collared-puffer-jacket-cream',
  'https://shopattersee.com/collections/new-fall-arrivals/products/the-feedbag-pockets-in-embroidered-crepe-espresso'
];

async function findPostByUrl(url) {
  // Try exact match first
  let { data } = await supabase
    .from('posts')
    .select('id, product_name, product_brand, source_url, image_urls')
    .eq('source_url', url)
    .single();

  if (data) return data;

  // Try partial match (in case of query params)
  const cleanUrl = url.split('?')[0];
  const { data: posts } = await supabase
    .from('posts')
    .select('id, product_name, product_brand, source_url, image_urls')
    .like('source_url', `${cleanUrl}%`)
    .limit(1);

  return posts?.[0] || null;
}

async function rescrapeAndUpdate(url, index, total) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${index + 1}/${total}] Processing: ${url}`);
  console.log('='.repeat(70));

  // Find the post
  console.log('🔍 Finding post in database...');
  const post = await findPostByUrl(url);

  if (!post) {
    console.log('❌ Post not found in database');
    return { success: false, error: 'not_found' };
  }

  console.log(`✅ Found: ${post.product_name}`);
  console.log(`   Brand: ${post.product_brand || 'Unknown'}`);
  console.log(`   Current images: ${post.image_urls?.length || 0}`);

  // Show current images status
  if (post.image_urls && post.image_urls.length > 0) {
    const brokenCount = post.image_urls.filter(u =>
      u.includes('supabase.co') || u.length < 50 || !u.includes('http')
    ).length;
    const bunnyCount = post.image_urls.filter(u => u.includes('b-cdn.net')).length;
    console.log(`   Status: ${bunnyCount} Bunny CDN, ${brokenCount} broken/other`);
  }

  // Scrape
  console.log('\n🌐 Re-scraping product...');
  try {
    const response = await axios.post(`${PARSER_URL}/scrape`, {
      url: url
    }, {
      timeout: 60000
    });

    if (!response.data.success) {
      console.log('❌ Scraping failed:', response.data.error);
      return { success: false, error: response.data.error };
    }

    const images = response.data.product.image_urls || [];
    console.log(`✅ Scraped ${images.length} new images`);

    if (images.length === 0) {
      console.log('❌ No images found');
      return { success: false, error: 'no_images' };
    }

    // Update database
    console.log('💾 Updating database...');
    const { error } = await supabase
      .from('posts')
      .update({
        image_urls: images,
        source_url: url // Update to clean URL
      })
      .eq('id', post.id);

    if (error) {
      console.log('❌ Database update failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Database updated successfully!');
    console.log('\nNew images:');
    images.forEach((img, i) => {
      console.log(`  [${i}] ${img.substring(0, 80)}${img.length > 80 ? '...' : ''}`);
    });

    return {
      success: true,
      productName: post.product_name,
      oldCount: post.image_urls?.length || 0,
      newCount: images.length
    };

  } catch (error) {
    console.log('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Re-scraping 3 Posts\n');

  const results = {
    success: 0,
    failed: 0,
    details: []
  };

  for (let i = 0; i < URLS.length; i++) {
    const result = await rescrapeAndUpdate(URLS[i], i, URLS.length);

    if (result.success) {
      results.success++;
      results.details.push({
        url: URLS[i],
        name: result.productName,
        status: 'success',
        oldCount: result.oldCount,
        newCount: result.newCount
      });
    } else {
      results.failed++;
      results.details.push({
        url: URLS[i],
        status: 'failed',
        error: result.error
      });
    }

    // Small delay between requests
    if (i < URLS.length - 1) {
      console.log('\n⏸️  Waiting 2 seconds before next post...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📝 Total: ${URLS.length}\n`);

  results.details.forEach((detail, i) => {
    if (detail.status === 'success') {
      console.log(`✅ ${detail.name}`);
      console.log(`   ${detail.oldCount} → ${detail.newCount} images`);
    } else {
      console.log(`❌ ${detail.url.substring(0, 60)}...`);
      console.log(`   Error: ${detail.error}`);
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(results.success === URLS.length ? '✅ ALL POSTS FIXED!' : '⚠️  Some posts failed');
  console.log('='.repeat(70));
}

main().catch(console.error);
