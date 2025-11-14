const axios = require('axios');

async function testRailwayDeployment() {
  const railwayUrl = 'https://bluestock-parser.up.railway.app';
  const aritziaUrl = 'https://www.aritzia.com/us/en/product/homestretch-rib-crew-longsleeve/102669.html?color=19631';

  console.log('🚂 Testing Railway Deployment...\n');
  console.log('Railway URL:', railwayUrl);
  console.log('Test URL:', aritziaUrl);
  console.log('---\n');

  try {
    // Test the deployment
    const response = await axios.post(`${railwayUrl}/scrape`, {
      url: aritziaUrl
    }, {
      timeout: 60000,
      validateStatus: () => true // Accept any status
    });

    console.log('📡 Response Status:', response.status);

    if (response.status === 200 && response.data.success) {
      console.log('✅ Railway deployment is working!');
      console.log('Product:', response.data.product?.product_name || response.data.product?.name);
      console.log('Price:', response.data.product?.sale_price || response.data.product?.price);
    } else {
      console.log('❌ Railway deployment returned an error:');
      console.log('Error:', response.data.error || response.data.message || 'Unknown error');
      console.log('User Message:', response.data.userMessage);

      // Check if it's the old error message
      if (response.data.error && response.data.error.includes('No scraper available')) {
        console.log('\n⚠️  ISSUE: Railway deployment is still running OLD CODE');
        console.log('The deployment hasn\'t picked up the latest changes from GitHub.');
        console.log('\nSOLUTION: You need to:');
        console.log('1. Check Railway dashboard for deployment status');
        console.log('2. Trigger a manual redeploy if auto-deploy is not enabled');
        console.log('3. Ensure Railway is connected to the correct GitHub branch (main)');
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.log('Request timed out after 60 seconds');
    }
  }
}

testRailwayDeployment();