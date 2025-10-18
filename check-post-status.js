#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, product_name, image_urls')
    .eq('id', '89ef4cbd-ca2c-4df0-b63a-a14b5f3148f2')
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('CURRENT STATE IN DATABASE');
  console.log('='.repeat(70));
  console.log('Product:', data.product_name);
  console.log('\nImage URLs:');
  data.image_urls.forEach((url, i) => {
    console.log(`  [${i}] ${url}`);
  });
  console.log('\nTotal images:', data.image_urls.length);
})();
