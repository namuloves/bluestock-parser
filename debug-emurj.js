const puppeteer = require('puppeteer');

async function debugEmurj() {
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
    
    console.log('\n=== Page Title ===');
    const title = await page.title();
    console.log(title);
    
    // Look for any size-related content
    const sizeContent = await page.evaluate(() => {
      const results = {
        buttons: [],
        links: [],
        tables: 0,
        sizeSelects: [],
        sizeTexts: []
      };
      
      // Find buttons with size text
      document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('size')) {
          results.buttons.push({
            text: btn.textContent.trim(),
            class: btn.className
          });
        }
      });
      
      // Find links with size text
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
      
      // Find size select dropdowns
      document.querySelectorAll('select').forEach(select => {
        const label = select.getAttribute('aria-label') || '';
        const name = select.name || '';
        if (label.toLowerCase().includes('size') || name.toLowerCase().includes('size')) {
          const options = Array.from(select.options).map(opt => opt.text);
          results.sizeSelects.push({
            label: label || name,
            options: options
          });
        }
      });
      
      // Look for size information in product details
      const productInfo = document.querySelector('.product-info, .product-details, [class*="product"]');
      if (productInfo) {
        const text = productInfo.textContent;
        if (text.includes('Size') || text.includes('Measurements')) {
          results.sizeTexts.push(text.substring(0, 500));
        }
      }
      
      // Check for accordion/collapsible sections
      const accordions = document.querySelectorAll('[class*="accordion"], [class*="collapse"], details');
      accordions.forEach(acc => {
        const text = acc.textContent?.toLowerCase() || '';
        if (text.includes('size') || text.includes('measurement')) {
          results.sizeTexts.push('Accordion found: ' + acc.textContent.substring(0, 200));
        }
      });
      
      return results;
    });
    
    console.log('\n=== Size-related Elements Found ===');
    console.log('Buttons:', sizeContent.buttons);
    console.log('Links:', sizeContent.links);
    console.log('Tables:', sizeContent.tables);
    console.log('Size Selects:', sizeContent.sizeSelects);
    console.log('Size Texts:', sizeContent.sizeTexts);
    
    // Try to find and click expandable sections
    console.log('\n=== Looking for expandable sections ===');
    const expanded = await page.evaluate(() => {
      const results = [];
      
      // Try clicking details/summary elements
      document.querySelectorAll('details summary').forEach(summary => {
        summary.click();
        results.push('Clicked: ' + summary.textContent);
      });
      
      // Try clicking accordion headers
      document.querySelectorAll('[class*="accordion-header"], [class*="accordion-trigger"]').forEach(header => {
        header.click();
        results.push('Clicked accordion: ' + header.textContent);
      });
      
      return results;
    });
    
    if (expanded.length > 0) {
      console.log('Expanded sections:', expanded);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for tables again after expansion
      const tablesAfter = await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        const tableData = [];
        tables.forEach(table => {
          const firstRow = table.querySelector('tr');
          if (firstRow) {
            tableData.push(firstRow.textContent.substring(0, 100));
          }
        });
        return tableData;
      });
      
      console.log('\nTables after expansion:', tablesAfter);
    }
    
    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'emurj-debug.png', fullPage: true });
    console.log('\n✅ Screenshot saved as emurj-debug.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugEmurj();