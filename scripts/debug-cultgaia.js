const puppeteer = require('puppeteer');

async function debugCultGaia() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const url = 'https://cultgaia.com/products/gia-dress-ivory';
  
  console.log('Navigating to:', url);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n=== Page Title ===');
    const title = await page.title();
    console.log(title);
    
    console.log('\n=== Looking for size-related elements ===');
    
    // Check for buttons/links with size guide text
    const sizeElements = await page.evaluate(() => {
      const results = {
        buttons: [],
        links: [],
        tables: 0,
        sizeChartElements: []
      };
      
      // Find all clickable elements
      const clickables = document.querySelectorAll('button, a, div[role="button"], span[role="button"], [onclick]');
      
      clickables.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        
        if (text.includes('size') || ariaLabel.includes('size') || className.includes('size')) {
          results.buttons.push({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 50),
            class: el.className?.substring(0, 100),
            hasChart: text.includes('chart') || text.includes('guide')
          });
        }
      });
      
      // Look for links specifically
      document.querySelectorAll('a').forEach(link => {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('size') && (text.includes('guide') || text.includes('chart'))) {
          results.links.push({
            text: link.textContent.trim(),
            href: link.href
          });
        }
      });
      
      // Count tables
      results.tables = document.querySelectorAll('table').length;
      
      // Look for any elements with size chart related classes
      const sizeChartSelectors = [
        '[class*="size-chart"]',
        '[class*="size-guide"]',
        '[class*="sizing"]',
        '[data-size-chart]',
        '.size-chart',
        '.size-guide'
      ];
      
      sizeChartSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.sizeChartElements.push({
            selector: selector,
            count: elements.length
          });
        }
      });
      
      return results;
    });
    
    console.log('Size-related buttons found:', sizeElements.buttons.filter(b => b.hasChart));
    console.log('Size guide links found:', sizeElements.links);
    console.log('Tables on page:', sizeElements.tables);
    console.log('Size chart elements:', sizeElements.sizeChartElements);
    
    // Try to find and click size guide
    console.log('\n=== Attempting to click size guide ===');
    
    const clicked = await page.evaluate(() => {
      // Look for common size guide triggers
      const patterns = [
        'size guide',
        'size chart',
        'sizing',
        'view size guide',
        'view size chart'
      ];
      
      const elements = document.querySelectorAll('button, a, div[role="button"], span');
      
      for (const el of elements) {
        const text = el.textContent?.toLowerCase() || '';
        for (const pattern of patterns) {
          if (text.includes(pattern)) {
            console.log('Clicking:', el.textContent);
            el.click();
            return { clicked: true, element: el.textContent };
          }
        }
      }
      
      return { clicked: false };
    });
    
    if (clicked.clicked) {
      console.log('Clicked element:', clicked.element);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check what appeared
      const afterClick = await page.evaluate(() => {
        // Look for modals, popups, or new content
        const modalSelectors = [
          '.modal',
          '[role="dialog"]',
          '.popup',
          '[class*="modal"]',
          '[class*="overlay"]',
          '.drawer',
          '[class*="drawer"]'
        ];
        
        const results = {
          modals: [],
          tables: 0,
          newContent: false
        };
        
        modalSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.offsetHeight > 100) {
              results.modals.push({
                selector: selector,
                hasTable: el.querySelector('table') !== null,
                text: el.textContent?.substring(0, 200)
              });
            }
          });
        });
        
        results.tables = document.querySelectorAll('table').length;
        
        return results;
      });
      
      console.log('\nAfter clicking:');
      console.log('Modals found:', afterClick.modals.length);
      if (afterClick.modals.length > 0) {
        console.log('Modal details:', afterClick.modals);
      }
      console.log('Tables:', afterClick.tables);
    } else {
      console.log('No size guide button found to click');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'cultgaia-debug.png', fullPage: false });
    console.log('\n✅ Screenshot saved as cultgaia-debug.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugCultGaia();