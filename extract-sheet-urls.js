const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function extractSpreadsheetURLs() {
  const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0SIWxh9GQT5LZ0lxoL7JXOCH8Z4mCHxYxQKjfy2t1s6tn98f-1JdyN2hi7mhq2Fw5MjW-aKSl_C8d/pubhtml';
  
  console.log('🚀 Starting Puppeteer to extract URLs from Google Sheets...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set longer timeout for Google Sheets to load
    page.setDefaultTimeout(60000);
    
    console.log('📄 Loading spreadsheet...');
    await page.goto(spreadsheetUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for the sheet to fully render
    console.log('⏳ Waiting for sheet to render...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to find and switch to the iframe if the sheet is in one
    const frames = page.frames();
    let targetFrame = page;
    
    for (const frame of frames) {
      const frameUrl = frame.url();
      if (frameUrl.includes('docs.google.com')) {
        console.log('Found Google Docs frame:', frameUrl);
        targetFrame = frame;
      }
    }
    
    // Extract all links from the spreadsheet
    console.log('🔍 Extracting URLs from cells...\n');
    
    const urls = await targetFrame.evaluate(() => {
      const foundUrls = new Set();
      
      // Method 1: Find all anchor tags
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const href = link.href;
        if (href && !href.includes('docs.google.com') && !href.includes('javascript:')) {
          foundUrls.add(href);
        }
      });
      
      // Method 2: Find cells that might contain URLs (text content)
      const cells = document.querySelectorAll('td, .cell, .waffle-cell, div[class*="cell"]');
      cells.forEach(cell => {
        const text = cell.textContent || cell.innerText || '';
        // Match URLs in text
        const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
        const matches = text.match(urlPattern);
        if (matches) {
          matches.forEach(url => foundUrls.add(url));
        }
      });
      
      // Method 3: Check data attributes
      const elementsWithData = document.querySelectorAll('[data-href], [data-url], [data-link]');
      elementsWithData.forEach(elem => {
        const url = elem.getAttribute('data-href') || elem.getAttribute('data-url') || elem.getAttribute('data-link');
        if (url && !url.includes('docs.google.com')) {
          foundUrls.add(url);
        }
      });
      
      return Array.from(foundUrls);
    });
    
    // If no URLs found, try scrolling to load more content
    if (urls.length === 0) {
      console.log('No URLs found initially, trying to scroll to load more content...');
      
      // Scroll down the page to trigger lazy loading
      await targetFrame.evaluate(() => {
        const scrollable = document.querySelector('.grid-container') || 
                          document.querySelector('.waffle-grid-container') || 
                          document.body;
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try extraction again after scrolling
      const urlsAfterScroll = await targetFrame.evaluate(() => {
        const foundUrls = new Set();
        
        // Re-run all extraction methods
        document.querySelectorAll('a').forEach(link => {
          const href = link.href;
          if (href && !href.includes('docs.google.com') && !href.includes('javascript:')) {
            foundUrls.add(href);
          }
        });
        
        const cells = document.querySelectorAll('td, .cell, .waffle-cell, div[class*="cell"]');
        cells.forEach(cell => {
          const text = cell.textContent || '';
          const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
          const matches = text.match(urlPattern);
          if (matches) {
            matches.forEach(url => foundUrls.add(url));
          }
        });
        
        return Array.from(foundUrls);
      });
      
      urls.push(...urlsAfterScroll);
    }
    
    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];
    
    console.log(`\n✅ Found ${uniqueUrls.length} unique URLs\n`);
    
    if (uniqueUrls.length > 0) {
      // Display first 10 URLs as preview
      console.log('Preview of extracted URLs:');
      uniqueUrls.slice(0, 10).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
      });
      
      if (uniqueUrls.length > 10) {
        console.log(`... and ${uniqueUrls.length - 10} more URLs`);
      }
      
      // Save to file
      const filename = 'extracted-urls.txt';
      await fs.writeFile(filename, uniqueUrls.join('\n'), 'utf8');
      console.log(`\n📁 All URLs saved to ${filename}`);
      
      // Also save as JSON for easier parsing
      const jsonFilename = 'extracted-urls.json';
      await fs.writeFile(jsonFilename, JSON.stringify(uniqueUrls, null, 2), 'utf8');
      console.log(`📁 URLs also saved as JSON to ${jsonFilename}`);
    } else {
      console.log('❌ No URLs found in the spreadsheet');
      console.log('\nPossible reasons:');
      console.log('1. The spreadsheet might require authentication');
      console.log('2. URLs might be in a different format than expected');
      console.log('3. The sheet might use dynamic loading that requires interaction');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'spreadsheet-debug.png', fullPage: true });
      console.log('\n📸 Screenshot saved as spreadsheet-debug.png for debugging');
    }
    
    return uniqueUrls;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Take error screenshot
    try {
      const page = (await browser.pages())[0];
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('📸 Error screenshot saved as error-screenshot.png');
    } catch (screenshotError) {
      console.log('Could not take error screenshot');
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the extraction
extractSpreadsheetURLs()
  .then(urls => {
    console.log(`\n🎉 Extraction complete! Found ${urls.length} URLs total`);
  })
  .catch(error => {
    console.error('\n❌ Extraction failed:', error.message);
    process.exit(1);
  });