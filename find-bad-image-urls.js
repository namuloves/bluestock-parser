#!/usr/bin/env node

/**
 * Find products with invalid image URLs
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

function isValidImageUrl(url) {
  if (!url) return false;

  // Check for common invalid patterns
  const invalidPatterns = [
    'supports3DS',
    'postalAddress',
    'email',
    'phone',
    'visa',
    'masterCard',
    'amex',
    'paypal',
    'schema.org',
    'javascript:',
    'mailto:',
    'tel:'
  ];

  return !invalidPatterns.some(pattern => url.includes(pattern));
}

async function main() {
  console.log('🔍 Finding products with invalid image URLs...\n');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_name, brand, vendor_url, image_urls');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  const badProducts = [];

  products.forEach(product => {
    if (!product.image_urls || product.image_urls.length === 0) return;

    const badUrls = product.image_urls.filter(url => !isValidImageUrl(url));

    if (badUrls.length > 0) {
      badProducts.push({
        ...product,
        badUrls,
        totalImages: product.image_urls.length
      });
    }
  });

  console.log(`Found ${badProducts.length} products with invalid image URLs:\n`);

  badProducts.forEach(product => {
    console.log(`📦 ${product.product_name} (${product.brand})`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Vendor: ${product.vendor_url}`);
    console.log(`   Total images: ${product.totalImages}`);
    console.log(`   Bad URLs (${product.badUrls.length}):`);
    product.badUrls.forEach(url => console.log(`     ❌ ${url}`));
    console.log('');
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total products checked: ${products.length}`);
  console.log(`   Products with bad URLs: ${badProducts.length}`);

  if (badProducts.length > 0) {
    console.log(`\n💡 To fix these products, re-scrape them:`);
    console.log(`   node recover-and-migrate-images.js --batch=10`);
  }
}

main().catch(console.error);
