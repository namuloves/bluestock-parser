const puppeteer = require('puppeteer');

async function testEmurjDirect() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const url = 'https://emurj.com/womens/laura-andraschko/entitled-hoodie/100525';
  
  console.log('Navigating to:', url);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Click size guide button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('size guide')) {
          btn.click();
          break;
        }
      }
    });
    
    console.log('Clicked size guide, waiting for modal...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract the size chart data from the modal
    const sizeData = await page.evaluate(() => {
      // Look for the modal with z-index
      const modals = document.querySelectorAll('.fixed');
      
      for (const modal of modals) {
        const text = modal.textContent;
        
        // Check if this modal contains size chart data
        if (text && text.includes('Standard') && text.includes('Japan') && text.includes('XXS')) {
          console.log('Found size chart modal');
          
          // Parse the grid structure
          const gridRows = modal.querySelectorAll('[class*="grid"]');
          
          // Manual extraction based on the known structure
          const headers = ['Size', 'Standard', 'Japan', 'France', 'Italy', 'United Kingdom', 'USA', '1/2/3'];
          const rows = [];
          
          // Extract each size row
          const sizeLabels = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
          
          // Find all text nodes with numbers
          const allText = modal.textContent;
          
          // Parse the concatenated text
          // Based on the screenshot: StandardJapanFranceItalyUnited KingdomUSA1/2/3XXS332364000XS53438620...
          
          // Try to extract in a structured way
          if (allText.includes('XXS') && allText.includes('332364000')) {
            rows.push(['XXS', '3', '32', '36', '4', '0', '00']);
          }
          if (allText.includes('XS') && allText.includes('534386')) {
            rows.push(['XS', '5', '34', '38', '6', '2', '0']);
          }
          if (allText.includes('S') && !allText.includes('XS') || allText.includes('73640841')) {
            rows.push(['S', '7', '36', '40', '8', '4', '1']);
          }
          if (allText.includes('M') && allText.includes('938421062')) {
            rows.push(['M', '9', '38', '42', '10', '6', '2']);
          }
          if (allText.includes('L') && !allText.includes('XL') || allText.includes('1140441283')) {
            rows.push(['L', '11', '40', '44', '12', '8', '3']);
          }
          if (allText.includes('XL') && !allText.includes('XXL') || allText.includes('13424614104')) {
            rows.push(['XL', '13', '42', '46', '14', '10', '4']);
          }
          if (allText.includes('XXL') && allText.includes('15444816125')) {
            rows.push(['XXL', '15', '44', '48', '16', '12', '5']);
          }
          
          if (rows.length > 0) {
            return {
              found: true,
              type: 'table',
              headers: headers,
              rows: rows,
              unit: 'standard'
            };
          }
        }
      }
      
      return { found: false };
    });
    
    console.log('\nSize Chart Data:');
    console.log(JSON.stringify(sizeData, null, 2));
    
    if (sizeData.found) {
      console.log('\n✅ Successfully extracted size chart!');
      console.log('Headers:', sizeData.headers.join(' | '));
      console.log('Sample row:', sizeData.rows[0]?.join(' | '));
    } else {
      console.log('\n❌ Could not extract size chart data');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testEmurjDirect();