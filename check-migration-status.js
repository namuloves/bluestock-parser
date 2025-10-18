#!/usr/bin/env node

/**
 * Check Migration Status
 * Quickly check how many products have been migrated to Bunny CDN
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
  console.log('📊 Migration Status Check\n');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_name, image_urls, vendor_url')
    .not('vendor_url', 'is', null);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  let supabaseCount = 0;
  let bunnyCount = 0;
  let mixedCount = 0;
  let otherCount = 0;

  products.forEach(product => {
    if (!product.image_urls || product.image_urls.length === 0) {
      otherCount++;
      return;
    }

    const hasSupabase = product.image_urls.some(url => isSupabaseImageUrl(url));
    const hasBunny = product.image_urls.some(url => isBunnyCDNUrl(url));

    if (hasSupabase && hasBunny) {
      mixedCount++;
    } else if (hasSupabase) {
      supabaseCount++;
    } else if (hasBunny) {
      bunnyCount++;
    } else {
      otherCount++;
    }
  });

  console.log(`Total Products: ${products.length}`);
  console.log(`✅ Migrated to Bunny CDN: ${bunnyCount}`);
  console.log(`⚠️  Still on Supabase: ${supabaseCount}`);
  console.log(`🔄 Mixed (both): ${mixedCount}`);
  console.log(`📁 Other sources: ${otherCount}`);
  console.log('');

  if (supabaseCount > 0) {
    console.log(`📋 ${supabaseCount} products still need migration`);
    console.log('Run: node recover-and-migrate-images.js --batch=10');
  } else {
    console.log('🎉 All products migrated!');
  }
}

main().catch(console.error);
