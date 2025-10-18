const { scrapeProduct } = require('./scrapers');

async function testRedirects() {
  console.log('🧪 Testing redirect handlers...\n');
  
  // Get some real URLs from our cleaned list
  const fs = require('fs').promises;
  const cleanedData = JSON.parse(await fs.readFile('cleaned-urls.json', 'utf8'));
  
  // Test URLs from different redirect services
  const testUrls = [
    // go.shopmy.us URLs
    ...cleanedData.byDomain['go.shopmy.us']?.slice(0, 2) || [],
    
    // bit.ly URLs
    ...cleanedData.byDomain['bit.ly']?.slice(0, 2) || [],
    
    // ShareASale URLs
    ...cleanedData.byDomain['shareasale.com']?.slice(0, 1) || [],
    
    // LinkSynergy URLs
    ...cleanedData.byDomain['click.linksynergy.com']?.slice(0, 1) || []
  ].filter(Boolean);
  
  console.log(`Testing ${testUrls.length} redirect URLs...\n`);
  
  for (const url of testUrls) {
    console.log('='.repeat(80));
    console.log(`Testing: ${url.substring(0, 80)}...`);
    console.log('='.repeat(80));
    
    try {
      const result = await scrapeProduct(url);
      
      if (result.success) {
        console.log('✅ Success!');
        console.log('Product:', result.product.product_name || result.product.name || 'Unknown');
        console.log('Brand:', result.product.brand || 'Unknown');
        console.log('Price:', result.product.sale_price || result.product.price || 'N/A');
        console.log('Final URL:', result.product.finalUrl?.substring(0, 60) || 'N/A');
        console.log('Redirects:', result.product.redirectCount || 0);
      } else {
        console.log('❌ Failed:', result.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
  }
  
  console.log('Testing complete!');
}

testRedirects().catch(console.error);