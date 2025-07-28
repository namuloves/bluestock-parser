# Proxy Setup Guide

Some websites (Ralph Lauren, COS, Sezane) block requests from cloud servers. To bypass this, you can use a proxy service.

## Configuration

1. Set environment variables in your `.env` file:
```bash
USE_PROXY=true
PROXY_URL=http://username:password@proxy-server.com:8080
```

2. Deploy with these environment variables on Railway or your hosting platform.

## Recommended Proxy Services

### Budget Options ($10-50/month)
- **ProxyMesh** - $10/month
  - 10 proxy servers
  - Good for basic scraping
  
- **ScraperAPI** - $29/month
  - 250k API credits
  - Handles JavaScript rendering
  - Format: `http://api.scraperapi.com?api_key=YOUR_KEY&url=TARGET_URL`

### Premium Options ($75+/month)
- **Smartproxy** - $75/month
  - Residential proxies
  - Better success rate
  
- **Bright Data** - $500+/month
  - Best success rate
  - Enterprise features

## ScraperAPI Example

1. Sign up at https://www.scraperapi.com
2. Get your API key
3. Set in `.env`:
```bash
USE_PROXY=true
PROXY_URL=http://scraperapi:YOUR_API_KEY@proxy-server.scraperapi.com:8001
```

## Testing

Test locally with proxy:
```bash
USE_PROXY=true PROXY_URL=your-proxy-url npm start
```

## Notes

- Proxies are only used for sites that block cloud servers (Ralph Lauren, COS, Sezane)
- Other sites (eBay, Garmentory) work without proxy
- Proxy adds 1-3 seconds to request time
- Some proxy services charge per request, monitor your usage