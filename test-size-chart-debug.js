const puppeteer = require('puppeteer');

async function debugSizeChart() {
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

  const testUrl = 'https://www.cos.com/en_usd/men/clothing/shirts/product.regular-fit-shirt-white.1228073001.html';
  
  console.log('Navigating to:', testUrl);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n=== Page Title ===');
    const title = await page.title();
    console.log(title);
    
    console.log('\n=== Looking for size-related elements ===');
    
    // Check for buttons/links with size guide text
    const sizeButtons = await page.evaluate(() => {
      const buttons = [];
      const allElements = document.querySelectorAll('button, a, div[role="button"], span');
      
      allElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('size') && (text.includes('guide') || text.includes('chart'))) {
          buttons.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            class: el.className,
            id: el.id
          });
        }
      });
      
      return buttons;
    });
    
    console.log('Size guide buttons found:', sizeButtons);
    
    // Check for tables
    const tables = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      return tables.length;
    });
    
    console.log('Tables found on page:', tables);
    
    // Check for any size-related text
    const sizeText = await page.evaluate(() => {
      const bodyText = document.body.textContent.toLowerCase();
      const sizeKeywords = ['size guide', 'size chart', 'sizing', 'measurements'];
      const found = [];
      
      sizeKeywords.forEach(keyword => {
        if (bodyText.includes(keyword)) {
          found.push(keyword);
        }
      });
      
      return found;
    });
    
    console.log('Size-related keywords found in page:', sizeText);
    
    // Try clicking first size button if found
    if (sizeButtons.length > 0) {
      console.log('\n=== Trying to click size guide ===');
      
      const clicked = await page.evaluate((buttonText) => {
        const elements = document.querySelectorAll('button, a, div[role="button"]');
        for (const el of elements) {
          if (el.textContent?.toLowerCase().includes('size') && 
              (el.textContent?.toLowerCase().includes('guide') || 
               el.textContent?.toLowerCase().includes('chart'))) {
            el.click();
            return true;
          }
        }
        return false;
      }, sizeButtons[0].text);
      
      if (clicked) {
        console.log('Clicked size guide button, waiting for modal...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for modal
        const modalContent = await page.evaluate(() => {
          const modalSelectors = [
            '.modal', '[role="dialog"]', '.popup', '.overlay',
            '[class*="modal"]', '[class*="dialog"]'
          ];
          
          for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && modal.offsetHeight > 0) {
              const tables = modal.querySelectorAll('table');
              return {
                found: true,
                hasTables: tables.length > 0,
                text: modal.textContent.substring(0, 200)
              };
            }
          }
          return { found: false };
        });
        
        console.log('Modal content:', modalContent);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugSizeChart();