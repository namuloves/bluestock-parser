const axios = require('axios');
const firecrawlKey = 'fc-7bca30d0661446e7b59b6b7e54fe2f3f';

async function findMainProductImages() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('🔍 Finding MAIN product images from Zara...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Call Firecrawl API directly
    const response = await axios.post('https://api.firecrawl.dev/v1/scrape', {
      url: url,
      formats: ['html'],
      waitFor: 3000
    }, {
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const html = response.data.data.html;
    console.log('✅ Got HTML from Firecrawl');

    // Extract all Zara image URLs
    const imagePattern = /https:\/\/static\.zara\.net[^"'\s,]+(jpg|jpeg|png|webp)(\?[^"'\s]*)?/gi;
    const allImages = [...new Set(html.match(imagePattern) || [])];

    console.log(`\nFound ${allImages.length} total Zara images`);

    // Filter for main product images (not thumbnails, not icons)
    const mainImages = allImages.filter(img => {
      // Main product images typically have these patterns
      const isMainImage = (
        img.includes('15205610') && // Contains product ID
        !img.includes('thumb') &&
        !img.includes('icon') &&
        !img.includes('badge') &&
        !img.includes('logo') &&
        (img.includes('-p/') || img.includes('-a') || img.includes('-e')) // Product/angle/extra views
      );
      return isMainImage;
    });

    // Remove duplicates with different query params
    const uniqueMainImages = [];
    const seenBaseUrls = new Set();

    for (const img of mainImages) {
      const baseUrl = img.split('?')[0];
      if (!seenBaseUrls.has(baseUrl)) {
        seenBaseUrls.add(baseUrl);
        uniqueMainImages.push(img);
      }
    }

    console.log(`\n✅ Found ${uniqueMainImages.length} MAIN product images:\n`);
    uniqueMainImages.forEach((img, i) => {
      // Extract the image type (p, a1, e1, etc)
      const typeMatch = img.match(/15205610\d+-([pae]\d*)/);
      const imageType = typeMatch ? typeMatch[1] : 'unknown';
      console.log(`${i + 1}. Type: ${imageType.padEnd(3)} - ${img.substring(0, 100)}...`);
    });

    // Test if these images are accessible
    console.log('\n🧪 Testing accessibility of main images:');
    for (const img of uniqueMainImages.slice(0, 3)) {
      try {
        const testResponse = await axios.head(img, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.zara.com/'
          },
          timeout: 5000,
          validateStatus: () => true
        });
        console.log(`  ${testResponse.status === 200 ? '✅' : '❌'} Status: ${testResponse.status}`);
      } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
      }
    }

    // Show how to extract just these in a selector
    console.log('\n📝 Suggested approach:');
    console.log('Look for images with these patterns:');
    console.log('  - Product ID in URL (15205610)');
    console.log('  - Image type suffix: -p (primary), -a1 (angle 1), -e1 (extra 1)');
    console.log('  - High resolution params: w=1920 or w=850');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

findMainProductImages();