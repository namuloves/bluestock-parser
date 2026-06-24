const fs = require('fs').promises;
const path = require('path');

async function createCSVSpreadsheet() {
  console.log('📊 Creating spreadsheet with all URLs...\n');
  
  try {
    // Read the cleaned URLs
    const cleanedData = JSON.parse(await fs.readFile('cleaned-urls.json', 'utf8'));
    const urls = cleanedData.urls;
    
    console.log(`📥 Processing ${urls.length} URLs...`);
    
    // Create CSV content with headers
    let csvContent = 'Index,URL,Domain,Path\n';
    
    urls.forEach((url, index) => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname + urlObj.search;
        
        // Escape quotes and commas in URL for CSV
        const escapedUrl = url.includes(',') || url.includes('"') 
          ? `"${url.replace(/"/g, '""')}"` 
          : url;
        const escapedPath = path.includes(',') || path.includes('"')
          ? `"${path.replace(/"/g, '""')}"`
          : path;
        
        csvContent += `${index + 1},${escapedUrl},${domain},${escapedPath}\n`;
      } catch (e) {
        // Handle invalid URLs
        const escapedUrl = url.includes(',') || url.includes('"') 
          ? `"${url.replace(/"/g, '""')}"` 
          : url;
        csvContent += `${index + 1},${escapedUrl},INVALID,N/A\n`;
      }
    });
    
    // Save as CSV file
    const filename = 'all-urls-spreadsheet.csv';
    await fs.writeFile(filename, csvContent, 'utf8');
    console.log(`✅ Spreadsheet created: ${filename}`);
    console.log(`   Total rows: ${urls.length + 1} (including header)`);
    
    // Create a summary spreadsheet by domain
    console.log('\n📊 Creating domain summary spreadsheet...');
    
    let summaryContent = 'Domain,Count,Sample URL\n';
    const sortedDomains = Object.keys(cleanedData.byDomain).sort((a, b) => 
      cleanedData.byDomain[b].length - cleanedData.byDomain[a].length
    );
    
    sortedDomains.forEach(domain => {
      const count = cleanedData.byDomain[domain].length;
      const sampleUrl = cleanedData.byDomain[domain][0];
      const escapedUrl = sampleUrl.includes(',') || sampleUrl.includes('"')
        ? `"${sampleUrl.replace(/"/g, '""')}"`
        : sampleUrl;
      
      summaryContent += `${domain},${count},${escapedUrl}\n`;
    });
    
    const summaryFilename = 'domain-summary-spreadsheet.csv';
    await fs.writeFile(summaryFilename, summaryContent, 'utf8');
    console.log(`✅ Domain summary created: ${summaryFilename}`);
    console.log(`   Total domains: ${sortedDomains.length}`);
    
    // Show preview
    console.log('\n📝 Preview of spreadsheet content:');
    const lines = csvContent.split('\n').slice(0, 11);
    lines.forEach(line => {
      console.log(line.substring(0, 120) + (line.length > 120 ? '...' : ''));
    });
    
    console.log('\n📌 Instructions:');
    console.log('1. Open "all-urls-spreadsheet.csv" in Excel, Google Sheets, or Numbers');
    console.log('2. The file contains all 1,200 URLs with index, domain, and path');
    console.log('3. Domain summary spreadsheet shows URL distribution by website');
    
    return {
      totalUrls: urls.length,
      totalDomains: sortedDomains.length,
      mainFile: filename,
      summaryFile: summaryFilename
    };
    
  } catch (error) {
    console.error('❌ Error creating spreadsheet:', error.message);
    throw error;
  }
}

// Run the spreadsheet creation
createCSVSpreadsheet()
  .then(result => {
    console.log(`\n✅ Success! Created spreadsheets with ${result.totalUrls} URLs across ${result.totalDomains} domains`);
  })
  .catch(error => {
    console.error('\n❌ Failed to create spreadsheet:', error.message);
    process.exit(1);
  });