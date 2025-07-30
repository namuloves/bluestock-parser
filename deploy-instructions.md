# Railway Deployment Instructions

## Environment Variables to Set on Railway

Add these environment variables in your Railway project settings:

1. **ENABLE_PUPPETEER=true**
   - This enables Puppeteer for better scraping of dynamic websites like Nordstrom
   - Required for Nordstrom to work properly

2. **NODE_ENV=production**
   - Sets the environment to production mode

3. **ANTHROPIC_API_KEY** (optional)
   - Your Claude AI API key if you want AI-enhanced descriptions for eBay products

4. **USE_PROXY** and **PROXY_URL** (optional)
   - If you have a proxy service, you can enable it for blocked sites
   - Set USE_PROXY=true and PROXY_URL=http://user:pass@proxy-host:port

## How to Set Environment Variables on Railway

1. Go to your Railway project dashboard
2. Click on your bluestock-parser service
3. Go to the "Variables" tab
4. Click "New Variable" and add:
   - Variable: ENABLE_PUPPETEER
   - Value: true
5. The service will automatically redeploy with the new settings

## Verify Deployment

After setting the environment variables and redeploying:

1. Check the Railway logs to ensure Puppeteer is enabled
2. Test a Nordstrom URL through your API
3. You should see "Puppeteer available: true" in the logs