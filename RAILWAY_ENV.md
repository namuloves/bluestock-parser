# Railway Environment Variables

## Required Variables

### Basic Configuration
- `NODE_ENV=production`
- `PORT` (Railway provides this automatically)

### Nordstrom Scraping
Since Nordstrom blocks many cloud server IPs, you have two options:

#### Option 1: Use a Proxy Service (Recommended)
If you have a proxy service (like ScraperAPI, Bright Data, or similar):

- `USE_PROXY=true`
- `PROXY_URL=http://username:password@proxy-host:port`

Example proxy services:
- ScraperAPI: `http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001`
- Bright Data: `http://username:password@zproxy.lum-superproxy.io:22225`

#### Option 2: Without Proxy
If you don't have a proxy, the scraper will still work but may be blocked by Nordstrom:
- Leave `USE_PROXY` unset or set to `false`
- The scraper will return a user-friendly message when blocked

### Optional Variables
- `ANTHROPIC_API_KEY` - For AI-enhanced eBay descriptions
- `FRONTEND_URL` - Your frontend URL for CORS (defaults to https://bluestock-bay.vercel.app)

## Setting Variables on Railway

1. Go to your Railway project
2. Click on the bluestock-parser service
3. Go to "Variables" tab
4. Add each variable as needed
5. Railway will automatically redeploy

## Testing the Deployment

After deployment, test with:
```bash
curl -X POST https://your-railway-url.up.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.nordstrom.com/s/7608820"}'
```