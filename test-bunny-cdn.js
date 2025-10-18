/**
 * Test Bunny CDN Integration
 * Verifies that scraped images are properly transformed through CDN
 */

const { getCDNService } = require('./services/bunny-cdn');
const { scrapeProduct } = require('./scrapers');

async function testBunnyCDN() {
  console.log('🐰 Testing Bunny CDN Integration\n');
  console.log('=' .repeat(60));

  const cdnService = getCDNService();

  // Test 1: URL Transformation
  console.log('\n📝 Test 1: URL Transformation');
  console.log('-'.repeat(60));

  const testUrls = [
    'https://www.zara.com/product/image.jpg',
    'https://uniqlo.scene7.com/is/image/UNIQLO/goods_69_445367',
    'https://xvelopers.supabase.co/storage/v1/object/public/product-images/test.jpg'
  ];

  testUrls.forEach(url => {
    const transformed = cdnService.transformImageUrl(url);
    console.log('Original:', url);
    console.log('CDN URL: ', transformed);
    console.log('');
  });

  // Test 2: Product Scraping with CDN
  console.log('\n📝 Test 2: Product Scraping with CDN Transformation');
  console.log('-'.repeat(60));

  const testProductUrl = 'https://www.uniqlo.com/us/en/products/E471974-000/00';

  try {
    console.log('Scraping:', testProductUrl);
    const result = await scrapeProduct(testProductUrl);

    if (result && result.product) {
      const product = result.product;
      console.log('\nProduct:', product.product_name || product.name);
      console.log('Original Images:', product.image_urls?.length || 0);

      // Transform through CDN
      const transformedProduct = cdnService.transformProductImages(product);

      console.log('\nTransformed Images:');
      (transformedProduct.image_urls || transformedProduct.images || []).slice(0, 3).forEach((url, idx) => {
        console.log(`  ${idx + 1}. ${url.substring(0, 100)}...`);
      });

      // Check if URLs are CDN URLs
      const firstImage = (transformedProduct.image_urls || transformedProduct.images || [])[0];
      const isCDN = firstImage && (
        firstImage.includes('b-cdn.net') ||
        firstImage.includes('image-proxy')
      );

      console.log('\n✅ CDN Transformation:', isCDN ? 'SUCCESS' : 'FAILED');
    }
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
  }

  // Test 3: Image Proxy Endpoint
  console.log('\n📝 Test 3: Image Proxy Endpoint');
  console.log('-'.repeat(60));

  const proxyUrl = 'http://localhost:3001/api/image-proxy';
  const testImageUrl = 'https://www.uniqlo.com/jp/ja/contents/feature/masterpiece/common_22fw/img/products/contentsArea_itemimg_16.jpg';

  console.log('Testing proxy endpoint...');
  console.log('Proxy URL:', proxyUrl);
  console.log('Test Image:', testImageUrl);

  try {
    const fetch = require('node-fetch');
    const response = await fetch(`${proxyUrl}?url=${encodeURIComponent(testImageUrl)}`);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const cacheControl = response.headers.get('cache-control');

      console.log('\n✅ Proxy Response:');
      console.log('  Status:', response.status);
      console.log('  Content-Type:', contentType);
      console.log('  Cache-Control:', cacheControl);
    } else {
      console.log('❌ Proxy failed:', response.status);
    }
  } catch (error) {
    console.log('⚠️  Proxy endpoint not available (server may not be running)');
  }

  // Test 4: Different image sizes
  console.log('\n📝 Test 4: Different Image Sizes');
  console.log('-'.repeat(60));

  const sampleUrl = 'https://example.com/product.jpg';

  console.log('Original:', sampleUrl);
  console.log('Thumbnail:', cdnService.getThumbnailUrl(sampleUrl));
  console.log('High Quality:', cdnService.getHighQualityUrl(sampleUrl));

  // Summary
  console.log('\n📊 Summary');
  console.log('=' .repeat(60));
  console.log('✅ CDN Service:', cdnService.enabled ? 'ENABLED' : 'DISABLED');
  console.log('✅ Pull Zone:', cdnService.pullZoneUrl);
  console.log('✅ Optimizer:', cdnService.optimizerEnabled ? 'ENABLED' : 'DISABLED');
  console.log('✅ Proxy Endpoint:', cdnService.proxyEndpoint);

  console.log('\n✅ Bunny CDN integration test complete!\n');
}

// Run the test
testBunnyCDN().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});