require('dotenv').config();
const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

async function debugSsenseHtml() {
  const parser = new FirecrawlParserV2();
  const url = 'https://www.ssense.com/en-us/women/product/marine-serre/regenerated-graphic-t-shirts-veiled-cap/18178011';

  try {
    const siteConfig = parser.getSiteConfig(url);
    const extractionPrompt = parser.buildExtractionPrompt(url);

    const scrapeParams = {
      formats: ['extract', 'markdown', 'html', 'screenshot', 'links'],
      extract: {
        schema: parser.productSchema,
        prompt: extractionPrompt,
        systemPrompt: "You are an expert at extracting e-commerce product data."
      },
      actions: siteConfig.actions || [],
      timeout: 60000,
      waitFor: 6000,
      onlyMainContent: true,
      removeBase64Images: false,
      blockAds: true,
      mobile: false,
      proxy: 'stealth',
      location: { country: 'US', languages: ['en-US'] }
    };

    const result = await parser.firecrawl.scrapeUrl(url, scrapeParams);

    if (result && result.success && result.html) {
      // Find "You May Also Like" section
      const mayAlsoLikeIndex = result.html.toLowerCase().indexOf('you may also like');
      const productHtml = mayAlsoLikeIndex > 0 ? result.html.substring(0, mayAlsoLikeIndex) : result.html;

      console.log('Product HTML section length:', productHtml.length);
      console.log('\n=== Sample HTML snippets with ssensemedia ===\n');

      // Find all occurrences of ssensemedia in the product section
      const ssenseRegex = /[^<>\n]{0,200}ssensemedia[^<>\n]{0,200}/gi;
      const matches = [...productHtml.matchAll(ssenseRegex)];

      matches.slice(0, 10).forEach((match, idx) => {
        console.log(`${idx + 1}. ${match[0]}`);
        console.log('---');
      });

      console.log(`\nTotal occurrences of "ssensemedia" in product section: ${matches.length}`);

      // Also show first few img tags
      console.log('\n=== First 5 img tags in product section ===\n');
      const imgRegex = /<img[^>]+>/gi;
      const imgMatches = [...productHtml.matchAll(imgRegex)];
      imgMatches.slice(0, 5).forEach((match, idx) => {
        console.log(`${idx + 1}. ${match[0]}`);
        console.log('---');
      });

    } else {
      console.log('Failed to get HTML from Firecrawl');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSsenseHtml();
