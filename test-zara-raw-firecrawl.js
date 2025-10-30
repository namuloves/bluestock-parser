const axios = require('axios');
const firecrawlKey = process.env.FIRECRAWL_API_KEY;

async function testFirecrawlDirectly() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  if (!firecrawlKey) {
    console.log('❌ FIRECRAWL_API_KEY not set');
    return;
  }

  console.log('🔥 Testing Firecrawl API directly for Zara...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Call Firecrawl API directly to see raw response
    const response = await axios.post('https://api.firecrawl.dev/v1/scrape', {
      url: url,
      formats: ['markdown', 'html'],
      waitFor: 3000,
      actions: [
        { type: 'wait', milliseconds: 2000 },
        { type: 'scroll', direction: 'down', amount: 500 }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const data = response.data.data;
    console.log('✅ Firecrawl API Response received');

    // Check for images in different places
    console.log('\n📸 Image Analysis:');

    // 1. Check metadata
    if (data.metadata) {
      console.log('\nMetadata:');
      console.log('  - Title:', data.metadata.title);
      console.log('  - Description:', data.metadata.description?.substring(0, 100));
      if (data.metadata.ogImage) {
        console.log('  - OG Image:', data.metadata.ogImage);
      }
    }

    // 2. Count images in HTML
    if (data.html) {
      const imgTags = (data.html.match(/<img[^>]+>/gi) || []);
      const pictureTags = (data.html.match(/<picture[^>]*>/gi) || []);
      const zaraImages = (data.html.match(/static\.zara\.net[^"'\s]+(jpg|jpeg|png|webp)/gi) || []);

      console.log('\nHTML Analysis:');
      console.log('  - <img> tags:', imgTags.length);
      console.log('  - <picture> tags:', pictureTags.length);
      console.log('  - Zara CDN images:', zaraImages.length);

      // Extract unique Zara image URLs
      const uniqueZaraImages = [...new Set(zaraImages)];
      if (uniqueZaraImages.length > 0) {
        console.log('\n🎯 Unique Zara images found:', uniqueZaraImages.length);
        uniqueZaraImages.slice(0, 10).forEach((img, i) => {
          console.log(`  ${i + 1}. ${img.substring(0, 80)}...`);
        });
      }

      // Look for specific selectors
      const selectors = [
        'media-image__image',
        'product-detail-images',
        'product-media',
        'carousel',
        'gallery'
      ];

      console.log('\nSelector presence:');
      selectors.forEach(sel => {
        const count = (data.html.match(new RegExp(sel, 'gi')) || []).length;
        if (count > 0) {
          console.log(`  - "${sel}": ${count} occurrences`);
        }
      });
    }

    // 3. Check markdown for image references
    if (data.markdown) {
      const mdImages = (data.markdown.match(/!\[.*?\]\([^)]+\)/g) || []);
      console.log('\n  - Markdown images:', mdImages.length);
      if (mdImages.length > 0) {
        console.log('    First few:', mdImages.slice(0, 3));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFirecrawlDirectly();