require('dotenv').config();
const { scrapeProduct } = require('./scrapers');

async function testSsenseRouting() {
  // Your example URL from the screenshots
  const url = 'https://www.ssense.com/en-us/women/product/marine-serre/regenerated-graphic-t-shirts-veiled-cap/18178011';

  console.log('🧪 Testing SSENSE routing fix...');
  console.log('URL:', url);
  console.log('Expected: Should route to Firecrawl and extract high-res images');
  console.log('---\n');

  try {
    const result = await scrapeProduct(url);

    console.log('\n📊 Results:');
    console.log('Success:', result.success);

    if (result.success && result.product) {
      const product = result.product;
      console.log('\n📦 Product Details:');
      console.log('Name:', product.product_name || product.name);
      console.log('Brand:', product.brand);
      console.log('Price:', product.sale_price || product.price, product.currency || 'USD');

      console.log('\n🖼️  Images:');
      const images = product.image_urls || product.images || [];
      console.log(`Found ${images.length} images:`);

      images.forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img}`);

        // Verify it's a high-res SSENSE image
        if (img.includes('img.ssensemedia.com/images/')) {
          console.log('     ✅ High-res SSENSE CDN image');
        } else {
          console.log('     ⚠️  Not a SSENSE CDN image');
        }

        // Check if it contains the product ID
        if (img.includes('18178011')) {
          console.log('     ✅ Contains product ID (18178011)');
        }
      });

      // Summary
      console.log('\n📈 Image Quality Check:');
      const highResImages = images.filter(img => img.includes('img.ssensemedia.com/images/'));
      const productIdImages = images.filter(img => img.includes('18178011'));

      console.log(`  High-res CDN images: ${highResImages.length}/${images.length}`);
      console.log(`  Images with product ID: ${productIdImages.length}/${images.length}`);

      if (highResImages.length >= 4) {
        console.log('\n✅ SUCCESS: Found multiple high-resolution product images!');
      } else if (highResImages.length > 0) {
        console.log('\n⚠️  PARTIAL: Found some high-res images, but less than expected (4+)');
      } else {
        console.log('\n❌ FAILED: No high-resolution images found');
      }

    } else {
      console.log('❌ Scraping failed');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

testSsenseRouting();
