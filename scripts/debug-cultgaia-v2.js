const puppeteer = require('puppeteer');

async function debugCultGaiaV2() {
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

  // Try a different product URL
  const url = 'https://cultgaia.com/collections/dresses/products/kamira-dress-black';
  
  console.log('Navigating to:', url);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Page loaded, checking for popups...');
    
    // Try to close any popups first
    await page.evaluate(() => {
      // Close email signup popups
      const closeButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="Close"], .close, button[class*="close"]');
      closeButtons.forEach(btn => {
        try {
          btn.click();
          console.log('Closed popup');
        } catch (e) {}
      });
      
      // Also try to close by clicking outside or pressing ESC
      const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal-backdrop"]');
      overlays.forEach(overlay => {
        try {
          overlay.click();
        } catch (e) {}
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== Looking for Size Guide ===');
    
    // Find size guide elements
    const sizeGuideInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('.js-size-guide-trigger, [class*="size-guide"], a:contains("Size Guide"), button:contains("Size Guide")');
      const results = [];
      
      // Also try text search
      document.querySelectorAll('a, button').forEach(el => {
        const text = el.textContent || '';
        if (text.toLowerCase().includes('size guide')) {
          results.push({
            tag: el.tagName,
            text: text.trim(),
            class: el.className,
            href: el.href || ''
          });
        }
      });
      
      return results;
    });
    
    console.log('Size guide elements found:', sizeGuideInfo);
    
    // Try clicking the size guide
    console.log('\n=== Clicking Size Guide ===');
    
    const clicked = await page.evaluate(() => {
      // First close any existing modals
      document.querySelectorAll('[role="dialog"]').forEach(dialog => {
        if (dialog.textContent.includes('10% off')) {
          dialog.style.display = 'none';
        }
      });
      
      // Find and click size guide
      const sizeGuideElements = document.querySelectorAll('.js-size-guide-trigger, a');
      
      for (const el of sizeGuideElements) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('size guide')) {
          console.log('Clicking:', el.textContent);
          el.click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      console.log('Clicked Size Guide, waiting for content...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check what appeared
      const sizeChartContent = await page.evaluate(() => {
        const results = {
          modals: [],
          tables: [],
          images: []
        };
        
        // Look for modals/drawers
        const modalSelectors = [
          '.size-guide-modal',
          '.size-chart-modal',
          '[class*="size-guide"]',
          '[role="dialog"]:not(:has(.email-signup))',
          '.drawer',
          '[class*="drawer"]'
        ];
        
        modalSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el.offsetHeight > 100 && !el.textContent.includes('10% off')) {
                const tables = el.querySelectorAll('table');
                const images = el.querySelectorAll('img');
                
                results.modals.push({
                  selector: selector,
                  visible: el.offsetHeight > 0,
                  hasTable: tables.length > 0,
                  hasImages: images.length > 0,
                  textPreview: el.textContent?.substring(0, 300)
                });
                
                // Extract tables
                tables.forEach(table => {
                  const headers = [];
                  const rows = [];
                  
                  // Get headers
                  table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td').forEach(cell => {
                    headers.push(cell.textContent.trim());
                  });
                  
                  // Get rows
                  table.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(tr => {
                    const row = [];
                    tr.querySelectorAll('td, th').forEach(cell => {
                      row.push(cell.textContent.trim());
                    });
                    if (row.length > 0) rows.push(row);
                  });
                  
                  if (headers.length > 0 || rows.length > 0) {
                    results.tables.push({ headers, rows });
                  }
                });
                
                // Extract size chart images
                images.forEach(img => {
                  if (img.alt?.toLowerCase().includes('size') || img.src?.toLowerCase().includes('size')) {
                    results.images.push({
                      src: img.src,
                      alt: img.alt
                    });
                  }
                });
              }
            });
          } catch (e) {
            console.error('Error checking selector:', selector, e);
          }
        });
        
        // Also check for tables outside modals
        document.querySelectorAll('table').forEach(table => {
          if (table.textContent.toLowerCase().includes('size') || 
              table.textContent.toLowerCase().includes('bust') ||
              table.textContent.toLowerCase().includes('waist')) {
            const headers = [];
            const rows = [];
            
            table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td').forEach(cell => {
              headers.push(cell.textContent.trim());
            });
            
            table.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(tr => {
              const row = [];
              tr.querySelectorAll('td, th').forEach(cell => {
                row.push(cell.textContent.trim());
              });
              if (row.length > 0) rows.push(row);
            });
            
            if (headers.length > 0 || rows.length > 0) {
              results.tables.push({ headers, rows, location: 'page' });
            }
          }
        });
        
        return results;
      });
      
      console.log('\n=== Size Chart Content Found ===');
      console.log('Modals:', sizeChartContent.modals);
      console.log('Tables:', sizeChartContent.tables);
      console.log('Images:', sizeChartContent.images);
      
      if (sizeChartContent.tables.length > 0) {
        console.log('\n✅ SIZE CHART TABLE FOUND!');
        sizeChartContent.tables.forEach((table, i) => {
          console.log(`\nTable ${i + 1}:`);
          console.log('Headers:', table.headers);
          console.log('Sample rows:', table.rows.slice(0, 3));
        });
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'cultgaia-v2-debug.png', fullPage: false });
    console.log('\n✅ Screenshot saved as cultgaia-v2-debug.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugCultGaiaV2();