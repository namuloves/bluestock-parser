const { scrapeEbay } = require('./scrapers/ebay');

async function testEbayDirect() {
  console.log('🧪 Testing eBay scraper directly...');

  const testUrl = 'https://www.ebay.com/itm/375642461030?_trkparms=amclksrc%3DITM%26aid%3D777008%26algo%3DPERSONAL.TOPIC%26ao%3D1%26asc%3D20250417133020%26meid%3D5d6c9baefa644f53ba5b4cf2c5963de5%26pid%3D102726%26rk%3D1%26rkt%3D1%26itm%3D375642461030%26pmt%3D1%26noa%3D1%26pg%3D4375194%26algv%3DRecentlyViewedItemsV2WithMLRPboosterAndUpdatedFeatures_BP&_trksid=p4375194.c102726.m162918';

  try {
    console.log('🔍 Testing URL:', testUrl);
    const result = await scrapeEbay(testUrl);

    console.log('✅ eBay scraper result:');
    console.log('- Product name:', result.product_name || result.name);
    console.log('- Brand:', result.brand);
    console.log('- Images found:', result.images?.length || 0);
    console.log('- Image URLs:', result.images);
    console.log('- Full result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ eBay scraper failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEbayDirect();