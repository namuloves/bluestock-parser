require('dotenv').config();
const FirecrawlApp = require('@mendable/firecrawl-js').default;

const url = 'https://www.mmmmood.com/products/3bb9ed08-0651-4ca7-910a-e9e8971827b2';
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

(async () => {
  try {
    console.log('Testing Firecrawl with rendering...');
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      waitFor: 2000
    });
    console.log('Success! Got', result.markdown?.length || 0, 'chars of markdown');

    // Look for image patterns in the markdown
    const imageMatches = result.markdown?.match(/!\[.*?\]\((.*?)\)/g) || [];
    console.log('Found', imageMatches.length, 'images in markdown');
    if (imageMatches.length > 0) {
      console.log('\nFirst 5 images:');
      imageMatches.slice(0, 5).forEach(img => console.log('  ', img));
    }

    // Look for product name
    const hasProductName = result.markdown?.includes('Monsieur Eau de Parfum');
    console.log('\nHas product name:', hasProductName);

    // Check for price
    const priceMatch = result.markdown?.match(/\$\d+/);
    console.log('Price found:', priceMatch?.[0] || 'none');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.details) console.error('Details:', error.details);
  }
})();
