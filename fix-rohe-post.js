#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POST_ID = '89ef4cbd-ca2c-4df0-b63a-a14b5f3148f2';
const SOURCE_URL = 'https://roheframes.com/products/relaxed-corduroy-trousers-dark-sage';

(async () => {
  console.log('🔧 Fixing Róhe post...\n');

  // 1. Scrape the product
  console.log('1. Scraping product from:', SOURCE_URL);
  const response = await axios.post('https://bluestock-parser.up.railway.app/scrape', {
    url: SOURCE_URL
  });

  if (!response.data.success) {
    console.error('❌ Scraping failed:', response.data.error);
    process.exit(1);
  }

  const images = response.data.product.image_urls;
  console.log(`✅ Scraped ${images.length} images\n`);

  images.forEach((url, i) => {
    console.log(`  [${i}] ${url}`);
  });

  // 2. Update the database
  console.log('\n2. Updating database...');
  const { error } = await supabase
    .from('posts')
    .update({ image_urls: images })
    .eq('id', POST_ID);

  if (error) {
    console.error('❌ Database update failed:', error);
    process.exit(1);
  }

  console.log('✅ Database updated successfully!');

  // 3. Verify
  console.log('\n3. Verifying update...');
  const { data: verifyData } = await supabase
    .from('posts')
    .select('image_urls')
    .eq('id', POST_ID)
    .single();

  console.log('Current image URLs in database:');
  verifyData.image_urls.forEach((url, i) => {
    console.log(`  [${i}] ${url}`);
  });

  console.log(`\n✅ FIXED! Post now has ${verifyData.image_urls.length} valid Bunny CDN images`);
})();
