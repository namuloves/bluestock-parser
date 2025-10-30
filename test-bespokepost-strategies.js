const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

async function testExtractionStrategies() {
  console.log('🧪 Testing which extraction strategy is setting the wrong name...\n');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  const html = await page.content();
  const $ = cheerio.load(html);

  // Test 1: JSON-LD
  console.log('=== 1. JSON-LD ===');
  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      console.log('Name:', data.name);
      console.log('Has suffix?', data.name?.includes('| Bespoke'));
    } catch(e) {
      console.log('Parse error');
    }
  } else {
    console.log('❌ Not found');
  }

  // Test 2: Open Graph
  console.log('\n=== 2. Open Graph ===');
  const ogTitle = $('meta[property="og:title"]').attr('content');
  console.log('og:title:', ogTitle);
  console.log('Has suffix?', ogTitle?.includes('| Bespoke'));

  // Test 3: Next.js Data
  console.log('\n=== 3. Next.js Data ===');
  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    try {
      const data = JSON.parse(nextData);
      console.log('Has __NEXT_DATA__: YES');
      // Try to find product name
      const str = JSON.stringify(data);
      if (str.includes('Dark Energy')) {
        console.log('Contains "Dark Energy": YES');
      }
    } catch(e) {
      console.log('Parse error');
    }
  } else {
    console.log('❌ Not found');
  }

  // Test 4: Bespoke Post Cache
  console.log('\n=== 4. Bespoke Post Cache (BP.CacheManager) ===');
  let foundCache = false;
  $('script').each((i, elem) => {
    const content = $(elem).html() || '';
    const productCacheMatch = content.match(/BP\.CacheManager\.set\("Product\.cache\.\d+",\s*({.*?})\);/s);
    if (productCacheMatch) {
      try {
        const productData = JSON.parse(productCacheMatch[1]);
        console.log('Name:', productData.name);
        console.log('Brand:', productData.brand?.name);
        console.log('Description:', productData.short_description || productData.description);
        console.log('Has suffix?', productData.name?.includes('| Bespoke'));
        foundCache = true;
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    }
  });
  if (!foundCache) {
    console.log('❌ Not found');
  }

  // Test 5: Generic h1
  console.log('\n=== 5. Generic h1 ===');
  const h1 = $('h1').first().text().trim();
  console.log('h1:', h1);
  console.log('Has suffix?', h1?.includes('| Bespoke'));

  await browser.close();
}

testExtractionStrategies().catch(console.error);
