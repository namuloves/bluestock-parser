require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function testSsenseMarkdown() {
  const parser = new FirecrawlParserV2();
  const url = 'https://www.ssense.com/en-us/women/product/marine-serre/regenerated-graphic-t-shirts-veiled-cap/18178011';

  console.log('🔍 Testing Firecrawl markdown for SSENSE...');
  console.log('URL:', url);
  console.log('---\n');

  try {
    // Access the Firecrawl API directly to see raw response
    const siteConfig = parser.getSiteConfig(url);
    const extractionPrompt = parser.buildExtractionPrompt(url);

    const scrapeParams = {
      formats: ['extract', 'markdown', 'html', 'screenshot', 'links'],
      extract: {
        schema: parser.productSchema,
        prompt: extractionPrompt,
        systemPrompt: "You are an expert at extracting e-commerce product data. Extract accurate product information from the page."
      },
      actions: siteConfig.actions || [],
      timeout: siteConfig.timeout || 60000,
      waitFor: siteConfig.waitFor || 3000,
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
      mobile: false,
      proxy: siteConfig.requiresProxy ? 'stealth' : 'basic',
      headers: siteConfig.headers || {},
      location: siteConfig.location || {
        country: 'US',
        languages: ['en-US']
      }
    };

    const result = await parser.firecrawl.scrapeUrl(url, scrapeParams);

    if (result && result.success) {
      console.log('✅ Firecrawl succeeded\n');

      // Show markdown content
      console.log('📝 MARKDOWN CONTENT:');
      console.log('Length:', result.markdown?.length || 0, 'characters');
      console.log('---');
      console.log(result.markdown?.substring(0, 2000) || 'No markdown');
      console.log('---\n');

      // Show links
      console.log('🔗 LINKS:');
      console.log('Total links:', result.links?.length || 0);
      const ssenseImageLinks = (result.links || []).filter(link =>
        link.includes('img.ssensemedia.com')
      );
      console.log('SSENSE image links:', ssenseImageLinks.length);
      console.log('First 10 SSENSE image links:');
      ssenseImageLinks.slice(0, 10).forEach((link, idx) => {
        console.log(`  ${idx + 1}. ${link}`);
      });
      console.log('---\n');

      // Show HTML snippet
      console.log('📄 HTML:');
      console.log('Length:', result.html?.length || 0, 'characters');
      console.log('Contains "product-detail":', result.html?.includes('product-detail') || false);
      console.log('Contains "img.ssensemedia":', result.html?.includes('img.ssensemedia') || false);

      // Count img tags
      const imgTags = (result.html || '').match(/<img[^>]*>/gi);
      console.log('Total img tags:', imgTags?.length || 0);

      // Extract and show extracted images
      console.log('\n🖼️  EXTRACTED IMAGES (from AI):');
      const extracted = result.extract || {};
      console.log('AI extracted images:', extracted.images?.length || 0);
      (extracted.images || []).slice(0, 10).forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img}`);
      });

    } else {
      console.log('❌ Firecrawl failed');
      console.log('Error:', result?.error || 'Unknown error');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testSsenseMarkdown();
