const puppeteer = require('puppeteer');

async function debugEmurjWithClick() {
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

  const url = 'https://emurj.com/womens/laura-andraschko/entitled-hoodie/100525';
  
  console.log('Navigating to:', url);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Looking for Size guide button...');
    
    // Click the size guide button
    const clicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('size guide')) {
          console.log('Found button:', btn.textContent);
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      console.log('✅ Clicked Size guide button, waiting for modal...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check what appeared
      const modalContent = await page.evaluate(() => {
        const results = {
          modals: [],
          tables: [],
          images: []
        };
        
        // Look for modals
        const modalSelectors = [
          '.modal', '[role="dialog"]', '.popup', '[class*="modal"]',
          '[class*="dialog"]', '[class*="overlay"]', '.fixed'
        ];
        
        modalSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.offsetHeight > 100) { // Only visible elements
              results.modals.push({
                selector: selector,
                text: el.textContent.substring(0, 200),
                hasTable: el.querySelector('table') !== null,
                tableCount: el.querySelectorAll('table').length
              });
            }
          });
        });
        
        // Look for all tables on page
        document.querySelectorAll('table').forEach(table => {
          const headers = [];
          const firstRow = [];
          
          // Get headers
          const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
          headerCells.forEach(cell => headers.push(cell.textContent.trim()));
          
          // Get first data row
          const dataRow = table.querySelector('tbody tr, tr:nth-child(2)');
          if (dataRow) {
            dataRow.querySelectorAll('td, th').forEach(cell => {
              firstRow.push(cell.textContent.trim());
            });
          }
          
          results.tables.push({
            headers: headers,
            firstRow: firstRow,
            rowCount: table.querySelectorAll('tr').length
          });
        });
        
        // Look for size chart images
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || '';
          const alt = img.alt || '';
          if (alt.toLowerCase().includes('size') || src.toLowerCase().includes('size')) {
            results.images.push({
              src: src.substring(0, 100),
              alt: alt
            });
          }
        });
        
        return results;
      });
      
      console.log('\n=== After clicking Size Guide ===');
      console.log('Modals found:', modalContent.modals.length);
      if (modalContent.modals.length > 0) {
        console.log('Modal details:', JSON.stringify(modalContent.modals, null, 2));
      }
      
      console.log('\nTables found:', modalContent.tables.length);
      if (modalContent.tables.length > 0) {
        console.log('Table details:', JSON.stringify(modalContent.tables, null, 2));
      }
      
      console.log('\nSize images found:', modalContent.images.length);
      if (modalContent.images.length > 0) {
        console.log('Image details:', modalContent.images);
      }
      
      // Take screenshot after clicking
      await page.screenshot({ path: 'emurj-after-click.png', fullPage: false });
      console.log('\n✅ Screenshot after click saved as emurj-after-click.png');
    } else {
      console.log('❌ Size guide button not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugEmurjWithClick();