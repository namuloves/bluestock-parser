# Upstash Redis Setup for Railway

## ⚠️ Important: Use Redis URL, not REST URL

You have two types of URLs in Upstash:
1. **REST URL** - For HTTP-based access (NOT what we need)
2. **Redis URL** - For Redis protocol (THIS is what we need)

## Getting the Correct URL from Upstash:

1. Go to your Upstash console: https://console.upstash.com
2. Click on your database (darling-corgi-6495)
3. Look for **"Redis"** section (not REST API)
4. Find **"Redis URL"** - it looks like:
   ```
   redis://default:YOUR_PASSWORD@darling-corgi-6495.upstash.io:6379
   ```

## What to Add to Railway:

Add ONLY this variable to your Railway parser service:

```
REDIS_URL=redis://default:YOUR_PASSWORD@darling-corgi-6495.upstash.io:6379
REDIS_ENABLED=true
```

## ❌ DO NOT USE:
- UPSTASH_REDIS_REST_URL (this is for REST API)
- UPSTASH_REDIS_REST_TOKEN (this is for REST API)

## Finding Your Redis URL in Upstash:

1. Login to Upstash Console
2. Click your database
3. You'll see multiple connection options:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Redis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoint: darling-corgi-6495.upstash.io:6379
Password: [hidden - click to copy]
Redis URL: redis://default:xxxxx@darling-corgi-6495.upstash.io:6379  ← USE THIS ONE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REST API (don't use these)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REST URL: https://darling-corgi-6495.upstash.io
REST Token: ARlfAAImcDJkYTcx...
```

## Complete Railway Variables:

```env
# Redis connection (get from Upstash Redis section)
REDIS_URL=redis://default:YOUR_ACTUAL_PASSWORD@darling-corgi-6495.upstash.io:6379
REDIS_ENABLED=true

# Cache settings
CACHE_TTL=3600
CACHE_ADMIN_KEY=your-secret-key-2024

# Parser settings
UNIVERSAL_LOG_LEVEL=normal
UNIVERSAL_MODE=production
NODE_ENV=production

# Your existing variables (keep these)
ANTHROPIC_API_KEY=xxx
DECODO_USERNAME=xxx
DECODO_PASSWORD=xxx
# etc...
```

## Testing After Setup:

1. Deploy to Railway
2. Visit: `https://your-app.up.railway.app/test-redis`
3. Should show:
   ```json
   {
     "connection": {
       "connected": true,
       "enabled": true
     }
   }
   ```

## If You Can't Find the Redis URL:

The Redis URL format for your Upstash instance would be:
```
redis://default:[PASSWORD]@darling-corgi-6495.upstash.io:6379
```

Where [PASSWORD] is your Redis password (not the REST token).

In Upstash console:
1. Click "Redis" tab (not REST API)
2. Click "Copy" next to Redis URL
3. Paste that into Railway as REDIS_URL