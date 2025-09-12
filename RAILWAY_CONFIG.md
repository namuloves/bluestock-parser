# Railway Configuration for Bluestock Parser

## Environment Variables to Set in Railway

Go to your Railway project dashboard and add these environment variables:

### Required Variables
```
NODE_ENV=production
PORT=3001

# Apify API Token (for scraping bot-protected sites like Massimo Dutti)
APIFY_API_TOKEN=your_apify_api_token_here

# Frontend URL for CORS
FRONTEND_URL=https://bluestock-bay.vercel.app

# Claude AI API Key (optional, for AI-enhanced descriptions)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Proxy Configuration (optional, for enhanced scraping)
USE_PROXY=true
DECODO_USERNAME=your_proxy_username
DECODO_PASSWORD=your_proxy_password
```

### eBay API Credentials (optional)
```
EBAY_APP_ID=your_ebay_app_id
EBAY_DEV_ID=your_ebay_dev_id
EBAY_CERT_ID=your_ebay_cert_id
```

### Note for Configuration
**Important:** Use your actual API keys from the `.env` file when configuring Railway. The values above are placeholders for security.

## How to Add Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service (bluestock-parser)
3. Go to the "Variables" tab
4. Click "Add Variable" or "Raw Editor"
5. Add each variable with its value
6. Railway will automatically redeploy with the new variables

## Supported Sites with Special Requirements

### Sites that require Apify (bot-protected):
- **Massimo Dutti** - Requires APIFY_API_TOKEN
- **Net-a-Porter** - Requires APIFY_API_TOKEN
- **SSENSE** - Works better with APIFY_API_TOKEN

### Sites that work without special configuration:
- Amazon
- eBay
- Zara
- Nordstrom
- Saks Fifth Avenue
- Ralph Lauren
- COS
- Sezane
- Shopify stores
- And many more...

## Troubleshooting

### If Massimo Dutti parsing fails:
1. Ensure APIFY_API_TOKEN is set in Railway variables
2. Check that the token is valid and has credits
3. The site has aggressive bot protection - some failures are expected

### If you get CORS errors:
1. Make sure FRONTEND_URL matches your Vercel deployment URL
2. Multiple frontend URLs are already whitelisted in the code

### If timeouts occur:
- Some sites (like Massimo Dutti) may take 30-60 seconds to scrape
- The server has a 30-second timeout by default
- Apify operations have a 90-second timeout

## Monitoring

Check your Railway logs for:
- `🤖 Using Apify Puppeteer` - Indicates Apify is being used
- `📱 Using fallback data` - Indicates scraping failed, using URL-based data
- `✅` - Successful operations
- `❌` - Failed operations

## Support

The parser will always return some data, even if scraping fails:
- Product name extracted from URL
- Brand detected from domain
- Placeholder message for users to visit the site directly