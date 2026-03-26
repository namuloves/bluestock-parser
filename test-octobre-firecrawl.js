const FirecrawlParserV2 = require('./scrapers/firecrawl-parser-v2');

const url = 'https://www.octobre-editions.com/us-en/product/sezane/kais-coat/blue-grey#size-2';

async function test() {
  console.log('Testing Octobre Editions URL with Firecrawl V2:', url);
  console.log('━'.repeat(60));

  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not set!');
    process.exit(1);
  }

  const parser = new FirecrawlParserV2();

  try {
    console.log('🔥 Using Firecrawl to bypass bot protection...\n');

    const result = await parser.scrape(url, {
      waitFor: 3000, // Wait for dynamic content
      timeout: 60000 // 60 second timeout
    });

    console.log('\n✅ FIRECRAWL RESULT:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n📊 SUMMARY:');
    console.log('Name:', result?.name);
    console.log('Brand:', result?.brand);
    console.log('Price:', result?.price);
    console.log('Currency:', result?.currency);
    console.log('Images:', result?.images?.length || 0);
    console.log('Description:', result?.description?.substring(0, 100));

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

test();
