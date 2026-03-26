const UniversalParser = require('./universal-parser-v3');

const url = 'https://www.octobre-editions.com/us-en/product/sezane/kais-coat/blue-grey#size-2';

async function test() {
  console.log('Testing Octobre Editions URL:', url);
  console.log('━'.repeat(60));

  const parser = new UniversalParser();

  try {
    const result = await parser.parse(url);

    console.log('\n✅ PARSING RESULT:');
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
