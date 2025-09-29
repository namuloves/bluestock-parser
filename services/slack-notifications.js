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