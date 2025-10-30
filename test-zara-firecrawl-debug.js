const axios = require('axios');

async function debugZaraFirecrawl() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('🔍 Testing Zara with Firecrawl to find all possible images...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Force using Firecrawl V2 with more detailed extraction
    const response = await axios.post('http://localhost:3001/scrape', {
      url: url,
      debug: true,
      extractAll: true  // Try to extract all possible data
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 90000
    });

    if (response.data.success) {
      const product = response.data.product;

      console.log('✅ Success!');
      console.log('\n📸 Images found:', product.images?.length || 0);

      if (product.images && product.images.length > 0) {
        console.log('\nAll image URLs:');
        product.images.forEach((img, i) => {
          console.log(`${i + 1}. ${img}`);
        });
      }

      // Check if there's raw HTML we can analyze
      if (product.html) {
        console.log('\n🔍 Analyzing HTML for image patterns...');

        // Count different image patterns
        const patterns = {
          'img tags': (product.html.match(/<img[^>]+>/gi) || []).length,
          'picture tags': (product.html.match(/<picture[^>]*>/gi) || []).length,
          'static.zara.net URLs': (product.html.match(/static\.zara\.net[^"'\s]+(jpg|jpeg|png|webp)/gi) || []).length,
          'data-src attributes': (product.html.match(/data-src="[^"]+"/gi) || []).length,
          'srcset attributes': (product.html.match(/srcset="[^"]+"/gi) || []).length
        };

        console.log('Found in HTML:');
        for (const [pattern, count] of Object.entries(patterns)) {
          console.log(`  - ${pattern}: ${count}`);
        }

        // Extract unique image URLs from HTML
        const imageUrlPattern = /https:\/\/static\.zara\.net[^"'\s,]+(jpg|jpeg|png|webp)/gi;
        const foundUrls = [...new Set(product.html.match(imageUrlPattern) || [])];

        if (foundUrls.length > 0) {
          console.log(`\n🔍 Unique image URLs in HTML: ${foundUrls.length}`);
          foundUrls.slice(0, 5).forEach(url => {
            console.log(`  - ${url.substring(0, 100)}...`);
          });
        }
      }

      // Check structured data
      if (product.structuredData) {
        console.log('\n📊 Structured Data:');
        console.log('  - Has structured data:', !!product.structuredData);
        if (product.structuredData.image) {
          const images = Array.isArray(product.structuredData.image)
            ? product.structuredData.image
            : [product.structuredData.image];
          console.log(`  - Images in structured data: ${images.length}`);
        }
      }

    } else {
      console.log('❌ Failed:', response.data.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

debugZaraFirecrawl();