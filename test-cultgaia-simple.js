const puppeteer = require('puppeteer');

async function testCultGaiaSimple() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  
  // Direct product URL
  const url = 'https://cultgaia.com/products/serita-knit-dress-black';
  
  console.log('Testing Cult Gaia:', url);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close any popups
    await page.evaluate(() => {
      // Close modal overlays
      document.querySelectorAll('[role="dialog"]').forEach(d => {
        if (d.textContent.includes('10%') || d.textContent.includes('email')) {
          d.remove();
        }
      });
      // Remove overlays
      document.querySelectorAll('.modal-backdrop, .overlay').forEach(o => o.remove());
    });
    
    // Check if page has size guide
    const hasGuide = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, button');
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('size guide')) {
          return true;
        }
      }
      return false;
    });
    
    console.log('Has size guide button:', hasGuide);
    
    if (hasGuide) {
      // Click size guide
      await page.evaluate(() => {
        const elements = document.querySelectorAll('a, button');
        for (const el of elements) {
          if (el.textContent?.toLowerCase().includes('size guide')) {
            el.click();
            break;
          }
        }
      });
      
      console.log('Clicked size guide, waiting...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for size chart content
      const sizeData = await page.evaluate(() => {
        // Look for any new content that appeared
        const allText = document.body.textContent;
        
        // Check for size keywords
        const hasChart = allText.includes('XS') && allText.includes('Bust') || 
                        allText.includes('Size') && allText.includes('Chest') ||
                        allText.includes('MEASUREMENTS');
        
        // Count tables
        const tables = document.querySelectorAll('table').length;
        
        // Look for images with size in name
        const sizeImages = [];
        document.querySelectorAll('img').forEach(img => {
          if (img.src?.toLowerCase().includes('size') || 
              img.alt?.toLowerCase().includes('size')) {
            sizeImages.push(img.src);
          }
        });
        
        return {
          hasChart,
          tables,
          sizeImages,
          pageText: allText.substring(0, 500)
        };
      });
      
      console.log('\nResults:');
      console.log('Has size chart text:', sizeData.hasChart);
      console.log('Number of tables:', sizeData.tables);
      console.log('Size images found:', sizeData.sizeImages.length);
      
      if (sizeData.sizeImages.length > 0) {
        console.log('Size chart images:', sizeData.sizeImages);
      }
    }
    
    await page.screenshot({ path: 'cultgaia-simple.png' });
    console.log('\nScreenshot saved as cultgaia-simple.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testCultGaiaSimple();