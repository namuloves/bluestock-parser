require('dotenv').config();
const https = require('https');

// Test Slack webhook
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl) {
  console.log('❌ SLACK_WEBHOOK_URL not found in environment variables');
  process.exit(1);
}

console.log('🧪 Testing Slack webhook...');
console.log('Webhook URL:', webhookUrl);

const testMessage = {
  text: "🧪 Test notification from local environment",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🧪 *Test Notification*\nThis is a test from your local bluestock-parser environment."
      }
    }
  ]
};

const payload = JSON.stringify(testMessage);
const url = new URL(webhookUrl);

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Slack webhook test successful!');
      console.log('Response:', data);
    } else {
      console.log('❌ Slack webhook test failed');
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(payload);
req.end();
