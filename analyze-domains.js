const fs = require('fs').promises;
const axios = require('axios');
const { getAxiosConfig } = require('./config/proxy');

async function checkIfShopify(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: status => status < 500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const html = response.data.toLowerCase();
    
    // Check for Shopify indicators
    const isShopify = 
      html.includes('shopify') ||
      html.includes('cdn.shopify') ||
      html.includes('/cdn/shop/') ||
      html.includes('myshopify.com') ||
      html.includes('shopify.theme') ||
      html.includes('shopify_checkout') ||
      html.includes('shopify-section');
    
    return isShopify;
  } catch (error) {
    return null; // Could not determine
  }
}

async function analyzeDomains() {
  console.log('🔍 Analyzing domains from spreadsheet...\n');
  
  try {
    // Read the cleaned URLs data
    const cleanedData = JSON.parse(await fs.readFile('cleaned-urls.json', 'utf8'));
    const byDomain = cleanedData.byDomain;
    
    // Read existing scrapers from index.js
    const indexContent = await fs.readFile('scrapers/index.js', 'utf8');
    const existingScrapers = {
      'amazon.': true,
      'ebay.': true,
      'etsy.': true,
      'garmentory.': true,
      'ralphlauren.': true,
      'cos.': true,
      'sezane.': true,
      'nordstrom.': true,
      'ssense.': true,
      'saksfifthavenue.': true,
      'saks.': true,
      'poshmark.': true
    };
    
    // Categorize domains
    const domainAnalysis = {
      existingScrapers: [],
      affiliateLinks: [],
      shopifyStores: [],
      needsParser: [],
      urlShorteners: [],
      unknown: []
    };
    
    console.log(`📊 Analyzing ${Object.keys(byDomain).length} unique domains...\n`);
    
    // Sort domains by count
    const sortedDomains = Object.keys(byDomain).sort((a, b) => 
      byDomain[b].length - byDomain[a].length
    );
    
    // Analyze each domain
    for (const domain of sortedDomains) {
      const count = byDomain[domain].length;
      const sampleUrl = byDomain[domain][0];
      
      // Check if we have an existing scraper
      let hasExistingScraper = false;
      for (const scraperDomain of Object.keys(existingScrapers)) {
        if (domain.includes(scraperDomain)) {
          hasExistingScraper = true;
          domainAnalysis.existingScrapers.push({ domain, count, sampleUrl });
          break;
        }
      }
      
      if (hasExistingScraper) continue;
      
      // Check for known patterns
      if (domain.includes('shopstyle') || 
          domain.includes('shopmy') || 
          domain.includes('linksynergy') || 
          domain.includes('shareasale')) {
        domainAnalysis.affiliateLinks.push({ domain, count, sampleUrl });
      } else if (domain.includes('bit.ly') || 
                 domain.includes('tinyurl') || 
                 domain.includes('short.link')) {
        domainAnalysis.urlShorteners.push({ domain, count, sampleUrl });
      } else {
        // For direct brand sites, check if Shopify (only for top domains to save time)
        if (count > 2 && !domain.includes('instagram') && !domain.includes('google')) {
          console.log(`Checking if ${domain} is Shopify...`);
          const isShopify = await checkIfShopify(sampleUrl);
          
          if (isShopify === true) {
            domainAnalysis.shopifyStores.push({ domain, count, sampleUrl });
          } else if (isShopify === false) {
            domainAnalysis.needsParser.push({ domain, count, sampleUrl });
          } else {
            domainAnalysis.unknown.push({ domain, count, sampleUrl });
          }
        } else {
          domainAnalysis.needsParser.push({ domain, count, sampleUrl });
        }
      }
    }
    
    // Create analysis report
    let report = '# Domain Analysis Report\n\n';
    report += `Total domains analyzed: ${Object.keys(byDomain).length}\n\n`;
    
    report += `## Existing Scrapers (${domainAnalysis.existingScrapers.length})\n`;
    domainAnalysis.existingScrapers.forEach(item => {
      report += `- ${item.domain}: ${item.count} URLs ✅\n`;
    });
    
    report += `\n## Shopify Stores (${domainAnalysis.shopifyStores.length})\n`;
    domainAnalysis.shopifyStores.forEach(item => {
      report += `- ${item.domain}: ${item.count} URLs 🛍️\n`;
    });
    
    report += `\n## Affiliate/Redirect Links (${domainAnalysis.affiliateLinks.length})\n`;
    domainAnalysis.affiliateLinks.slice(0, 10).forEach(item => {
      report += `- ${item.domain}: ${item.count} URLs 🔗\n`;
    });
    
    report += `\n## URL Shorteners (${domainAnalysis.urlShorteners.length})\n`;
    domainAnalysis.urlShorteners.forEach(item => {
      report += `- ${item.domain}: ${item.count} URLs 🔗\n`;
    });
    
    report += `\n## Needs Custom Parser (${domainAnalysis.needsParser.length})\n`;
    report += `Top priority sites (by URL count):\n`;
    domainAnalysis.needsParser
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .forEach((item, i) => {
        report += `${i + 1}. ${item.domain}: ${item.count} URLs\n`;
      });
    
    // Save analysis report
    await fs.writeFile('domain-analysis.md', report, 'utf8');
    console.log('\n📁 Analysis saved to domain-analysis.md');
    
    // Create CSV with domain status
    let csvContent = 'Domain,URL Count,Status,Parser Needed,Sample URL\n';
    
    sortedDomains.forEach(domain => {
      const count = byDomain[domain].length;
      const sampleUrl = byDomain[domain][0];
      let status = 'Unknown';
      let parserNeeded = 'Y';
      
      // Determine status
      if (domainAnalysis.existingScrapers.find(d => d.domain === domain)) {
        status = 'Has Scraper';
        parserNeeded = 'N';
      } else if (domainAnalysis.shopifyStores.find(d => d.domain === domain)) {
        status = 'Shopify';
        parserNeeded = 'Shopify';
      } else if (domainAnalysis.affiliateLinks.find(d => d.domain === domain)) {
        status = 'Affiliate/Redirect';
        parserNeeded = 'Redirect';
      } else if (domainAnalysis.urlShorteners.find(d => d.domain === domain)) {
        status = 'URL Shortener';
        parserNeeded = 'Redirect';
      } else {
        status = 'Needs Parser';
        parserNeeded = 'Y';
      }
      
      const escapedUrl = sampleUrl.includes(',') ? `"${sampleUrl}"` : sampleUrl;
      csvContent += `${domain},${count},${status},${parserNeeded},${escapedUrl}\n`;
    });
    
    await fs.writeFile('domain-status.csv', csvContent, 'utf8');
    console.log('📁 Domain status spreadsheet saved to domain-status.csv');
    
    // Show summary
    console.log('\n📊 Summary:');
    console.log(`✅ Existing scrapers: ${domainAnalysis.existingScrapers.length} domains`);
    console.log(`🛍️ Shopify stores: ${domainAnalysis.shopifyStores.length} domains`);
    console.log(`🔗 Affiliate/redirects: ${domainAnalysis.affiliateLinks.length} domains`);
    console.log(`📦 Need custom parsers: ${domainAnalysis.needsParser.length} domains`);
    
    return domainAnalysis;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run analysis
analyzeDomains()
  .then(analysis => {
    console.log('\n✅ Analysis complete!');
    console.log('\nNext steps:');
    console.log('1. Develop Shopify universal scraper');
    console.log('2. Develop redirect/affiliate link handler');
    console.log('3. Create custom parsers for top brand sites');
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error.message);
  });