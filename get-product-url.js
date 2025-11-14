require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getProductUrl() {
  const productId = '0d969107-db94-4837-950d-7f7cc83393c7';

  console.log('🔍 Fetching product from database...');
  console.log('Product ID:', productId);

  const { data, error } = await supabase
    .from('products')
    .select('vendor_url, product_name, brand')
    .eq('id', productId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data) {
    console.log('\n✅ Found product:');
    console.log('Name:', data.product_name);
    console.log('Brand:', data.brand);
    console.log('Vendor URL:', data.vendor_url);
  } else {
    console.log('❌ Product not found');
  }
}

getProductUrl();
