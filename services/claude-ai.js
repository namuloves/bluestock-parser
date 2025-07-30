const Anthropic = require('@anthropic-ai/sdk');
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

class ClaudeAIService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateProductDescription(productInfo) {
    try {
      const prompt = this.buildPrompt(productInfo);
      
      const message = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Using Haiku for cost efficiency
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return message.content[0].text.trim();
    } catch (error) {
      console.error('Claude AI error:', error);
      throw error;
    }
  }

  buildPrompt(productInfo) {
    const { title, brand, condition, specifics, price } = productInfo;
    
    // Build a structured prompt
    let prompt = `Generate a concise, engaging product description for this eBay item. Focus on key features, condition, and value proposition.

Product: ${title}
Brand: ${brand || 'Unbranded'}
Condition: ${condition}
Price: ${price}

Item Specifications:`;

    // Add relevant specifics
    Object.entries(specifics || {}).forEach(([key, value]) => {
      // Skip pricing and seller notes in description
      if (!key.includes('price') && !key.includes('Seller Notes') && !key.includes('Estimated')) {
        prompt += `\n- ${key}: ${value}`;
      }
    });

    prompt += `\n\nInstructions:
- Write a 2-3 sentence description
- Highlight the item's condition and any unique features
- Mention the brand prominently
- Be factual and avoid hyperbole
- Don't mention price or seller information
- NEVER write placeholder text like "no description provided" or "description not available"
- If you cannot generate a meaningful description, just describe the basic item type and condition`;

    return prompt;
  }

  async enhanceProductWithDescription(product) {
    if (!product.aiContext || !product.aiContext.needsDescription) {
      return product;
    }

    try {
      const description = await this.generateProductDescription(product.aiContext.productInfo);
      
      // Update the product with AI description
      product.description = description;
      product.aiContext.description = description;
      product.aiContext.generatedAt = new Date().toISOString();
      
      return product;
    } catch (error) {
      console.error('Failed to generate AI description:', error);
      // Return product without description
      return product;
    }
  }
  
  async analyzeImage(base64Image, prompt) {
    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      return message.content[0].text.trim();
    } catch (error) {
      console.error('Claude AI image analysis error:', error);
      throw error;
    }
  }
}

module.exports = ClaudeAIService;