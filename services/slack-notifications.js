const https = require('https');
const url = require('url');

class SlackNotificationService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!this.webhookUrl) {
      console.log('⚠️  Slack webhook URL not configured. Notifications disabled.');
    }
  }

  async sendNotification(message) {
    if (!this.webhookUrl) {
      console.log('Slack notification skipped (no webhook URL):', message.text);
      return;
    }

    const payload = JSON.stringify(message);
    const parsedUrl = url.parse(this.webhookUrl);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Slack notification sent successfully');
            resolve(data);
          } else {
            console.error('❌ Slack notification failed:', res.statusCode, data);
            reject(new Error(`Slack API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Slack notification error:', error);
        reject(error);
      });

      req.write(payload);
      req.end();
    });
  }

  async notifyParsingFailure(details) {
    const { url, error, userEmail, timestamp, additionalInfo } = details;

    const message = {
      text: `🚨 *PARSING FAILED*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Product Parsing Failed"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*URL:*\n${url}`
            },
            {
              type: "mrkdwn",
              text: `*Error:*\n${error}`
            },
            {
              type: "mrkdwn",
              text: `*User:*\n${userEmail || 'Anonymous'}`
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    };

    if (additionalInfo) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Additional Info:*\n\`\`\`${JSON.stringify(additionalInfo, null, 2)}\`\`\``
        }
      });
    }

    try {
      await this.sendNotification(message);
    } catch (error) {
      console.error('Failed to send parsing failure notification:', error);
    }
  }

  async notifyNewUser(details) {
    const { email, timestamp, source, userId } = details;

    const message = {
      text: `🎉 *NEW USER REGISTERED*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 New User Registered"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Email:*\n${email}`
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(timestamp).toLocaleString()}`
            },
            {
              type: "mrkdwn",
              text: `*Source:*\n${source || 'Direct signup'}`
            },
            {
              type: "mrkdwn",
              text: `*User ID:*\n${userId}`
            }
          ]
        }
      ]
    };

    try {
      await this.sendNotification(message);
    } catch (error) {
      console.error('Failed to send new user notification:', error);
    }
  }

  async notifyParsingSuccess(details) {
    const { url, productName, userEmail, timestamp } = details;

    const message = {
      text: `✅ *PARSING SUCCESS*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *Successfully parsed:* ${productName}\n*URL:* ${url}\n*User:* ${userEmail || 'Anonymous'}\n*Time:* ${new Date(timestamp).toLocaleString()}`
          }
        }
      ]
    };

    try {
      await this.sendNotification(message);
    } catch (error) {
      console.error('Failed to send parsing success notification:', error);
    }
  }

  async notifyInvalidProduct(details) {
    const { url, product, validationErrors, userEmail, timestamp } = details;

    // Check which core fields are missing or invalid
    const missingFields = [];
    const invalidFields = [];

    // Check core product categories
    if (!product.name || product.name.trim().length < 3) {
      missingFields.push('Product Name');
    }
    if (!product.brand || product.brand.trim().length < 1) {
      missingFields.push('Brand Name');
    }
    if (!product.price || product.price <= 0) {
      missingFields.push('Price');
    }
    if (!product.images || product.images.length === 0) {
      missingFields.push('Product Photos');
    }

    // Check for invalid values
    if (product.name && (product.name.includes('undefined') || product.name.includes('null') || product.name.includes('test'))) {
      invalidFields.push('Product Name (contains invalid text)');
    }
    if (product.brand && (product.brand.includes('undefined') || product.brand.includes('null') || product.brand.includes('brand'))) {
      invalidFields.push('Brand Name (contains invalid text)');
    }
    if (product.images && product.images.some(img => img.includes('placeholder') || img.includes('no-image'))) {
      invalidFields.push('Product Photos (contains placeholder images)');
    }
    
    // Check for potentially inaccessible images (common patterns that return 403)
    if (product.images && product.images.length > 0) {
      const suspiciousImages = product.images.filter(img => {
        return img.includes('static.zara.net') || // Zara images often return 403
               img.includes('placeholder') ||
               img.includes('no-image') ||
               img.includes('default') ||
               img.length < 20; // Very short URLs are suspicious
      });
      
      if (suspiciousImages.length === product.images.length) {
        invalidFields.push('Product Photos (images may be inaccessible - common with Zara URLs)');
      }
    }

    const message = {
      text: `⚠️ *INVALID PRODUCT DATA*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ Product Parsed but Invalid Data"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*URL:*\n${url}`
            },
            {
              type: "mrkdwn",
              text: `*User:*\n${userEmail || 'Anonymous'}`
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    };

    // Add missing fields section
    if (missingFields.length > 0) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Missing Core Data:*\n${missingFields.map(field => `• ${field}`).join('\n')}`
        }
      });
    }

    // Add invalid fields section
    if (invalidFields.length > 0) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*⚠️ Invalid Data:*\n${invalidFields.map(field => `• ${field}`).join('\n')}`
        }
      });
    }

    // Add validation errors if available
    if (validationErrors && validationErrors.length > 0) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🔍 Validation Errors:*\n${validationErrors.map(err => `• ${err.message || err}`).join('\n')}`
        }
      });
    }

    // Add product data preview
    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📦 Product Data Preview:*\n\`\`\`${JSON.stringify({
          name: product.name || 'MISSING',
          brand: product.brand || 'MISSING',
          price: product.price || 'MISSING',
          imageCount: product.images ? product.images.length : 0
        }, null, 2)}\`\`\``
      }
    });

    try {
      await this.sendNotification(message);
    } catch (error) {
      console.error('Failed to send invalid product notification:', error);
    }
  }

  // Test notification
  async sendTestNotification() {
    const message = {
      text: `🧪 *TEST NOTIFICATION*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🧪 *Bluestock notifications are working!*\nTime: ${new Date().toLocaleString()}`
          }
        }
      ]
    };

    try {
      await this.sendNotification(message);
      return true;
    } catch (error) {
      console.error('Test notification failed:', error);
      return false;
    }
  }
}

module.exports = SlackNotificationService;