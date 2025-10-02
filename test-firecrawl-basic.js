require('dotenv').config();
const FirecrawlApp = require('@mendable/firecrawl-js').default;

async function testBasic() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  console.log('API Key:', apiKey);

  const firecrawl = new FirecrawlApp({ apiKey });

  // Test with a simpler site first
  const testUrl = 'https://www.zara.com/us/en/technical-bomber-jacket-p08073403.html';

  console.log('Testing Firecrawl basic scrape...');
  console.log('URL:', testUrl);
  console.log('---');

  try {
    const result = await firecrawl.scrapeUrl(testUrl, {
      formats: ['markdown', 'html'],
      timeout: 60000
    });

    console.log('✅ Scrape successful!');
    console.log('\nMarkdown preview (first 500 chars):');
    console.log(result.markdown?.substring(0, 500));
    console.log('\nHTML preview (first 500 chars):');
    console.log(result.html?.substring(0, 500));
    console.log('\nFull result keys:', Object.keys(result));
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

testBasic();
