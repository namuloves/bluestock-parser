# Railway Redis Setup Guide

## Setting up Redis on Railway

### Option 1: Use Railway's Redis Template (Easiest)

1. **Add Redis Service in Railway**
   - In your Railway project, click "+ New"
   - Select "Database" → "Add Redis"
   - Railway creates a Redis service

2. **Get the Connection Details**
   Railway provides these variables (check the Redis service's Variables tab):
   - `REDIS_HOST` - The host address
   - `REDIS_PORT` - Usually 6379
   - `REDIS_PASSWORD` - Auto-generated password
   - `REDIS_URL` - Sometimes provided, sometimes not

3. **If REDIS_URL is NOT provided**, construct it yourself:

   In your parser service's variables, add:
   ```
   REDIS_URL=redis://default:${{Redis.REDIS_PASSWORD}}@${{Redis.REDIS_HOST}}:${{Redis.REDIS_PORT}}
   ```

   Or manually construct it:
   ```
   REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@YOUR_REDIS_HOST:6379
   ```

### Option 2: Use External Redis (More Reliable)

Since Railway's Redis can be tricky, consider using:

#### **Upstash (Recommended for Railway)**
1. Go to [console.upstash.com](https://console.upstash.com)
2. Create free Redis database (10,000 requests/day free)
3. Copy the "Redis URL" from REST API section
4. Add to Railway variables:
   ```
   REDIS_URL=redis://default:YOUR_UPSTASH_PASSWORD@YOUR_ENDPOINT.upstash.io:6379
   ```

#### **Redis Cloud**
1. Go to [redis.com/try-free](https://redis.com/try-free/)
2. Create free database (30MB free)
3. Get connection string
4. Add to Railway variables:
   ```
   REDIS_URL=redis://default:YOUR_PASSWORD@redis-12345.c1.us-east-1.ec2.cloud.redislabs.com:12345
   ```

### Option 3: Reference Variables Between Services

If you added Redis in Railway, you can reference its variables:

1. **In your parser service, go to Variables**
2. **Add new variable:**
   ```
   Name: REDIS_URL
   Value: redis://default:${{Redis.REDIS_PASSWORD}}@${{Redis.RAILWAY_PRIVATE_DOMAIN}}:6379
   ```

   Or use the TCP Proxy:
   ```
   Name: REDIS_URL
   Value: redis://default:${{Redis.REDIS_PASSWORD}}@${{Redis.RAILWAY_TCP_PROXY_DOMAIN}}:${{Redis.RAILWAY_TCP_PROXY_PORT}}
   ```

## Testing Your Redis Connection

Add this temporary endpoint to test Redis:

```javascript
app.get('/test-redis', async (req, res) => {
  try {
    const { getCache } = require('./cache/redis-cache');
    const cache = getCache();
    const metrics = await cache.getMetrics();
    res.json({
      redis_url_set: !!process.env.REDIS_URL,
      redis_connected: metrics.connected,
      metrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Environment Variables for Railway

Add these to your parser service in Railway:

```env
# Redis (one of these approaches)
REDIS_URL=<constructed from above>

# Or if not using REDIS_URL
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
REDIS_DB=0

# Cache Configuration
REDIS_ENABLED=true
CACHE_TTL=3600
CACHE_ADMIN_KEY=your-secret-admin-key

# Parser Configuration
UNIVERSAL_LOG_LEVEL=normal
UNIVERSAL_MODE=production
NODE_ENV=production
```

## Troubleshooting

### If Redis connection fails:

1. **Check Railway logs** for error messages
2. **Verify the REDIS_URL** format is correct
3. **Try external Redis** (Upstash/Redis Cloud) if Railway's Redis has issues

### Common Railway Redis Issues:

- **No REDIS_URL provided**: Construct it manually
- **Connection refused**: Use RAILWAY_PRIVATE_DOMAIN for internal connection
- **Authentication failed**: Check password is correctly referenced

### Quick Test Commands:

```bash
# Test from your local machine (if Redis is public)
redis-cli -u redis://default:PASSWORD@HOST:PORT ping

# Test via your deployed app
curl https://your-app.up.railway.app/health | jq .checks.redis
```

## Fallback: Disable Redis

If Redis won't work, the parser still functions without it:

```env
REDIS_ENABLED=false
```

The parser will work but without caching benefits.