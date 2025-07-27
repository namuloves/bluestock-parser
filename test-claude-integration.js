const { scrapeEbay, enhanceWithAI } = require('./scrapers/ebay');
const ClaudeAIService = require('./services/claude-ai');

async function testClaudeIntegration() {
  console.log('🤖 Testing eBay + Claude AI Integration\n');
  
  // Check if API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY not found in environment');
    console.log('Please set it in your .env file or environment:\n');
    console.log('ANTHROPIC_API_KEY=your_api_key_here\n');
    console.log('You can get an API key from: https://console.anthropic.com/');
    return;
  }

  try {
    // Initialize Claude AI service
    const claudeAI = new ClaudeAIService();
    
    // Test URL
    const url = 'https://www.ebay.com/itm/167374673335';
    
    console.log('Step 1: Scraping product data with axios/cheerio...');
    const startTime = Date.now();
    const product = await scrapeEbay(url);
    const scrapingTime = Date.now() - startTime;
    console.log(`✅ Scraped in ${scrapingTime}ms\n`);
    
    console.log('📦 Product Info:');
    console.log(`  Title: ${product.title}`);
    console.log(`  Brand: ${product.brand}`);
    console.log(`  Condition: ${product.condition}`);
    console.log(`  Current Description: ${product.description}\n`);
    
    console.log('Step 2: Generating description with Claude AI...');
    const aiStartTime = Date.now();
    const enhancedProduct = await enhanceWithAI(product, claudeAI);
    const aiTime = Date.now() - aiStartTime;
    console.log(`✅ AI generation completed in ${aiTime}ms\n`);
    
    console.log('🎯 AI-Generated Description:');
    console.log(enhancedProduct.description);
    
    console.log('\n📊 Performance Summary:');
    console.log(`  - Web scraping: ${scrapingTime}ms`);
    console.log(`  - AI generation: ${aiTime}ms`);
    console.log(`  - Total time: ${scrapingTime + aiTime}ms`);
    
    // Save full result for inspection
    const fs = require('fs');
    fs.writeFileSync(
      `claude-enhanced-product-${Date.now()}.json`, 
      JSON.stringify(enhancedProduct, null, 2)
    );
    console.log('\n💾 Full result saved to claude-enhanced-product-*.json');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔑 Authentication Error:');
      console.log('Your API key might be invalid or expired.');
      console.log('Please check your ANTHROPIC_API_KEY in .env file');
    }
  }
}

// Run the test
testClaudeIntegration();