const fs = require('fs').promises;

async function cleanGoogleRedirectURLs() {
  console.log('🧹 Cleaning Google redirect URLs...\n');
  
  try {
    // Read the extracted URLs
    const rawUrls = JSON.parse(await fs.readFile('extracted-urls.json', 'utf8'));
    console.log(`📥 Loaded ${rawUrls.length} raw URLs`);
    
    const cleanedUrls = [];
    const failedUrls = [];
    
    for (const url of rawUrls) {
      try {
        // Parse the Google redirect URL
        const urlObj = new URL(url);
        
        if (urlObj.hostname === 'www.google.com' && urlObj.pathname === '/url') {
          // Extract the actual URL from the 'q' parameter
          const actualUrl = urlObj.searchParams.get('q');
          if (actualUrl) {
            // Decode the URL if it's encoded
            const decodedUrl = decodeURIComponent(actualUrl);
            cleanedUrls.push(decodedUrl);
          } else {
            failedUrls.push(url);
          }
        } else {
          // Not a Google redirect, keep as is
          cleanedUrls.push(url);
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse URL: ${url.substring(0, 50)}...`);
        failedUrls.push(url);
      }
    }
    
    // Remove duplicates
    const uniqueUrls = [...new Set(cleanedUrls)];
    
    console.log(`\n✅ Cleaned ${uniqueUrls.length} unique URLs`);
    console.log(`⚠️ Failed to clean ${failedUrls.length} URLs`);
    
    // Group URLs by domain for better organization
    const urlsByDomain = {};
    for (const url of uniqueUrls) {
      try {
        const domain = new URL(url).hostname;
        if (!urlsByDomain[domain]) {
          urlsByDomain[domain] = [];
        }
        urlsByDomain[domain].push(url);
      } catch (e) {
        if (!urlsByDomain['invalid']) {
          urlsByDomain['invalid'] = [];
        }
        urlsByDomain['invalid'].push(url);
      }
    }
    
    // Show statistics
    console.log('\n📊 URL Distribution by Domain:');
    const sortedDomains = Object.keys(urlsByDomain).sort((a, b) => 
      urlsByDomain[b].length - urlsByDomain[a].length
    );
    
    sortedDomains.slice(0, 15).forEach(domain => {
      console.log(`  ${domain}: ${urlsByDomain[domain].length} URLs`);
    });
    
    if (sortedDomains.length > 15) {
      console.log(`  ... and ${sortedDomains.length - 15} more domains`);
    }
    
    // Save cleaned URLs
    await fs.writeFile('cleaned-urls.txt', uniqueUrls.join('\n'), 'utf8');
    console.log('\n📁 Cleaned URLs saved to cleaned-urls.txt');
    
    // Save as JSON with domain grouping
    await fs.writeFile('cleaned-urls.json', JSON.stringify({
      urls: uniqueUrls,
      byDomain: urlsByDomain,
      stats: {
        total: uniqueUrls.length,
        domains: Object.keys(urlsByDomain).length,
        failed: failedUrls.length
      }
    }, null, 2), 'utf8');
    console.log('📁 Detailed data saved to cleaned-urls.json');
    
    // Save URLs for testing (first 50 varied URLs)
    const testUrls = [];
    for (const domain of sortedDomains) {
      if (testUrls.length >= 50) break;
      testUrls.push(...urlsByDomain[domain].slice(0, 2));
    }
    
    await fs.writeFile('test-urls.txt', testUrls.slice(0, 50).join('\n'), 'utf8');
    console.log('📁 Sample test URLs saved to test-urls.txt');
    
    // Show preview of cleaned URLs
    console.log('\n📝 Preview of cleaned URLs:');
    uniqueUrls.slice(0, 10).forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
    
    return uniqueUrls;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the cleaning
cleanGoogleRedirectURLs()
  .then(urls => {
    console.log(`\n🎉 Cleaning complete! ${urls.length} clean URLs ready for testing`);
  })
  .catch(error => {
    console.error('\n❌ Cleaning failed:', error.message);
    process.exit(1);
  });