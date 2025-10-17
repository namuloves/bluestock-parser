require('dotenv').config();
const SlackNotificationService = require('./services/slack-notifications');

async function testNotification() {
  console.log('🧪 Testing Slack notification...');
  
  const slackNotifications = new SlackNotificationService();
  
  try {
    await slackNotifications.notifyInvalidProduct({
      url: 'https://www.zara.com/us/en/test-product.html',
      product: {
        name: 'Test Product',
        brand: 'Zara',
        price: 59.9,
        images: ['https://static.zara.net/photos/test.jpg']
      },
      validationErrors: [{ message: 'Images may be inaccessible (static.zara.net URLs)' }],
      userEmail: 'test@example.com',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Notification sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
}

testNotification();

