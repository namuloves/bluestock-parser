# Decodo Proxy Setup for Railway

## Environment Variables to Add on Railway

### Option 1: If you have username and password from Decodo
```
USE_PROXY=true
DECODO_USERNAME=your_username
DECODO_PASSWORD=your_password
```

### Option 2: If you only have an API key
```
USE_PROXY=true
DECODO_API_KEY=f98d29ebb30390441cfecf3218bf3f6f1d2317ee935c65269629d4d4a0b63f54dbba20ffa2d362d114f5d61486b9172b2405df4a005ddb41ace36c94e4affe2e204340aee0756bbae20684ee8d8f3a21
```

### Option 3: Direct proxy URL (if Decodo gave you a specific format)
```
USE_PROXY=true
PROXY_URL=http://username:password@gate.decodo.com:10001
```

## How to Add on Railway

1. Go to your Railway project dashboard
2. Click on your `bluestock-parser` service
3. Go to the "Variables" tab
4. Click "New Variable" and add:
   - Variable: `USE_PROXY`
   - Value: `true`
5. Click "New Variable" again and add:
   - Variable: `DECODO_API_KEY`
   - Value: `f98d29ebb30390441cfecf3218bf3f6f1d2317ee935c65269629d4d4a0b63f54dbba20ffa2d362d114f5d61486b9172b2405df4a005ddb41ace36c94e4affe2e204340aee0756bbae20684ee8d8f3a21`

Railway will automatically redeploy your service with the proxy enabled.

## Testing

After Railway redeploys, your Nordstrom scraping should work! The proxy will:
- Route requests through Decodo's servers
- Bypass Nordstrom's IP blocks
- Work with both the HTML scraper and Puppeteer

## What This Does

- All requests to Nordstrom, Ralph Lauren, COS, and Sezane will go through Decodo
- Other sites will use direct connections (faster and saves proxy credits)
- You'll see "🔐 Using Decodo proxy service" in your logs when it's active