const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testFWRDTabs() {
  const url = 'https://www.fwrd.com/product-bode-spirit-sweater-in-blue/BOFE-MK12/?d=Mens';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Loading page...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click on Details tab if it exists
  console.log('Looking for Details tab...');

  const tabContent = await page.evaluate(() => {
    const results = {
      tabsFound: [],
      detailsContent: null,
      tabPanels: []
    };

    // Find all tabs
    const tabs = document.querySelectorAll('[data-tab-content], .tabs__link, [role="tab"]');
    tabs.forEach(tab => {
      results.tabsFound.push({
        text: tab.innerText?.trim(),
        dataContent: tab.getAttribute('data-tab-content')
      });
    });

    // Look for Details tab specifically
    const detailsTab = Array.from(tabs).find(tab =>
      tab.innerText?.toLowerCase().includes('detail')
    );

    if (detailsTab) {
      // Click it if found
      detailsTab.click();
    }

    // Look for tab panels
    document.querySelectorAll('[role="tabpanel"], .tabs__content, [class*="tab-content"]').forEach(panel => {
      const content = panel.innerText?.trim();
      if (content && content.length > 20) {
        results.tabPanels.push(content.substring(0, 500));
      }
    });

    // Look directly for the details content
    const detailsContent = document.querySelector('[data-tab-content="details"], #details, .details-content');
    if (detailsContent) {
      results.detailsContent = detailsContent.innerText;
    }

    return results;
  });

  console.log('Tab Data:', JSON.stringify(tabContent, null, 2));

  // Wait for any content to load after clicking
  await new Promise(r => setTimeout(r, 2000));

  // Check for content in the Details section
  const detailsData = await page.evaluate(() => {
    // Look for the active tab panel
    const activePanel = document.querySelector('.tabs__content.active, [role="tabpanel"][aria-hidden="false"]');
    if (activePanel) {
      return activePanel.innerText;
    }

    // Alternative: look for any visible details content
    const anyDetails = document.querySelector('[class*="details"]:not([class*="cookie"])');
    if (anyDetails) {
      return anyDetails.innerText;
    }

    return null;
  });

  console.log('\nDetails Content:', detailsData);

  await browser.close();
}

testFWRDTabs().catch(console.error);