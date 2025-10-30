const puppeteer = require('puppeteer');

async function debugBespokePost() {
  console.log('🔍 Debugging Bespoke Post Solar Panel...\n');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  const data = await page.evaluate(() => {
    // Product name options
    const name1 = document.querySelector('h1')?.textContent?.trim();
    const name2 = document.querySelector('[itemProp="name"]')?.textContent?.trim();
    const name3 = document.title;

    // Description options
    const desc1 = document.querySelector('[itemProp="description"]')?.textContent?.trim();
    const desc2 = document.querySelector('.product-description')?.textContent?.trim();
    const desc3 = document.querySelector('[data-test="product-description"]')?.textContent?.trim();
    const desc4 = Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 50);

    // Check for __NEXT_DATA__
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    let productFromNext = null;
    if (nextDataEl) {
      try {
        const parsed = JSON.parse(nextDataEl.textContent);
        const pageProps = parsed?.props?.pageProps;
        productFromNext = {
          hasPageProps: !!pageProps,
          keys: Object.keys(pageProps || {}).slice(0, 15),
          product: pageProps?.product
        };
      } catch(e) {
        productFromNext = { error: e.message };
      }
    }

    // Get all meta tags
    const metaTags = {};
    document.querySelectorAll('meta[property], meta[name]').forEach(meta => {
      const key = meta.getAttribute('property') || meta.getAttribute('name');
      metaTags[key] = meta.getAttribute('content');
    });

    return {
      names: { h1: name1, itemProp: name2, title: name3 },
      descriptions: { itemProp: desc1, class: desc2, dataTest: desc3, paragraphs: desc4 },
      nextData: productFromNext,
      metaTags: metaTags
    };
  });

  console.log('=== PRODUCT NAMES ===');
  console.log('H1:', data.names.h1);
  console.log('itemProp:', data.names.itemProp);
  console.log('Title:', data.names.title);

  console.log('\n=== DESCRIPTIONS ===');
  console.log('itemProp:', data.descriptions.itemProp?.substring(0, 150));
  console.log('class:', data.descriptions.class?.substring(0, 150));
  console.log('dataTest:', data.descriptions.dataTest?.substring(0, 150));
  console.log('Paragraphs found:', data.descriptions.paragraphs?.length || 0);
  if (data.descriptions.paragraphs?.length > 0) {
    console.log('First paragraph:', data.descriptions.paragraphs[0]?.substring(0, 150));
  }

  console.log('\n=== NEXT_DATA ===');
  if (data.nextData) {
    console.log('Has pageProps:', data.nextData.hasPageProps);
    console.log('Keys:', data.nextData.keys?.join(', '));
    if (data.nextData.product) {
      console.log('\n📦 Product from Next.js:');
      console.log('Name:', data.nextData.product.name);
      console.log('Description:', data.nextData.product.description?.substring(0, 200));
      console.log('Price:', data.nextData.product.price);
      console.log('Images:', data.nextData.product.images?.length);
    }
  } else {
    console.log('No __NEXT_DATA__ found');
  }

  console.log('\n=== OG META TAGS ===');
  console.log('og:title:', data.metaTags['og:title']);
  console.log('og:description:', data.metaTags['og:description']?.substring(0, 150));

  await browser.close();
}

debugBespokePost().catch(console.error);
