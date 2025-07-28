const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ClaudeAIService = require('../../services/claude-ai');

puppeteer.use(StealthPlugin());

async function scrapeRalphLaurenWithAI(url, options = {}) {
  let browser;
  let page;
  
  try {
    // Initialize AI service
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('AI service not initialized. Please set ANTHROPIC_API_KEY');
    }
    const aiService = new ClaudeAIService();
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: options.headless !== false ? 'new' : false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    console.log('Navigating to Ralph Lauren...');
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
    } catch (navError) {
      console.log('Navigation blocked, continuing anyway...');
    }
    
    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take a screenshot
    console.log('Taking screenshot for AI analysis...');
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false, // Just the viewport to focus on main content
      type: 'jpeg',
      quality: 80 // Reduce file size for faster processing
    });
    
    // Analyze with AI
    console.log('Analyzing with Claude AI...');
    const prompt = `Analyze this Ralph Lauren product page screenshot and extract product information.

Extract:
1. Product name
2. Price
3. Color
4. Sizes available
5. Description (if visible)

Respond ONLY with JSON:
{
  "name": "product name",
  "price": "current price",
  "color": "color",
  "sizes": ["S", "M", "L"],
  "description": "description or null",
  "brand": "Ralph Lauren"
}`;

    // Add timeout for AI analysis
    const aiResponsePromise = aiService.analyzeImage(screenshot, prompt);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
    );
    
    const aiResponse = await Promise.race([aiResponsePromise, timeoutPromise]);
    
    // Parse AI response
    let productData;
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback parsing
      productData = {
        name: extractBetween(aiResponse, 'name":', ',') || 'Ralph Lauren Product',
        price: extractBetween(aiResponse, 'price":', ',') || 'Price not available',
        description: extractBetween(aiResponse, 'description":', ',') || ''
      };
    }
    
    // Try to get images by finding img tags
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter(img => {
          const src = img.src || '';
          const alt = img.alt || '';
          return src.includes('ralphlauren') && 
                 (src.includes('product') || alt.toLowerCase().includes('product'));
        })
        .map(img => img.src)
        .slice(0, 5); // Get up to 5 images
    });
    
    // Combine AI results with scraped images
    return {
      ...productData,
      images: images || [],
      url: url,
      source: 'ai-analysis',
      // Ensure we have the database schema fields
      name: productData.name,
      sizes: productData.sizes || [],
      color: productData.color || '',
      brand: productData.brand || 'Ralph Lauren',
      isOnSale: productData.onSale || false,
      saleBadge: productData.onSale ? 'SALE' : null
    };
    
  } catch (error) {
    console.error('Ralph Lauren AI scraper error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to extract text between markers
function extractBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return null;
  
  const valueStart = startIndex + start.length;
  const endIndex = text.indexOf(end, valueStart);
  
  if (endIndex === -1) return null;
  
  return text.substring(valueStart, endIndex).replace(/['"]/g, '').trim();
}

module.exports = { scrapeRalphLaurenWithAI };