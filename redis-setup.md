# Redis Setup for Bluestock Parser

## Option 1: Local Redis (Development)

### Install Redis locally (if not installed)
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis

# Check if Redis is running
redis-cli ping  # Should return "PONG"
```

### Configure for Parser
```bash
# Connect to Redis
redis-cli

# Select database 1 for parser (keep DB 0 for other apps)
SELECT 1

# Check it's empty
DBSIZE  # Should return 0 if fresh

# Set a test key
SET test "Parser Redis Ready"
GET test
DEL test

# Exit
exit
```

## Option 2: Redis Cloud (Recommended for Production)

### 1. Sign up for free tier
- Go to [Redis Cloud](https://redis.com/try-free/)
- Create free account (30MB free, no credit card)
- Create new database

### 2. Get your credentials
- Database endpoint: `redis-xxxxx.c1.us-east-1.ec2.cloud.redislabs.com:12345`
- Password: `your-password`
- Database name: Usually pre-selected

### 3. Configure in .env
```env
REDIS_URL=redis://default:your-password@redis-xxxxx.c1.us-east-1.ec2.cloud.redislabs.com:12345
REDIS_ENABLED=true
```

## Option 3: Upstash (Serverless Redis)

### 1. Sign up for free tier
- Go to [Upstash](https://console.upstash.com/)
- Create free account (10,000 requests/day free)
- Create new Redis database

### 2. Get Redis URL
- Copy the "Redis URL" from dashboard
- It looks like: `redis://default:xxxxx@us1-xxxxx.upstash.io:6379`

### 3. Configure in .env
```env
REDIS_URL=redis://default:xxxxx@us1-xxxxx.upstash.io:6379
REDIS_ENABLED=true
```

## Testing Your Redis Connection

```bash
# Test with the parser's Redis client
node -e "
const { getCache } = require('./cache/redis-cache');
const cache = getCache();
setTimeout(async () => {
  const metrics = await cache.getMetrics();
  console.log('Redis Status:', metrics.connected ? '✅ Connected' : '❌ Not connected');
  console.log('Metrics:', metrics);
  process.exit(0);
}, 1000);
"
```

## Cache Management Commands

### View cache statistics
```bash
redis-cli
SELECT 1  # Or your DB number
INFO stats
DBSIZE  # Number of keys
```

### Clear parser cache
```bash
# Clear all parser cache
redis-cli --scan --pattern "parser:*" | xargs redis-cli DEL

# Or use the API endpoint
curl -X POST http://localhost:3001/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"auth": "your-secret-admin-key"}'
```

### Monitor cache in real-time
```bash
redis-cli MONITOR  # See all Redis commands in real-time
```

## Production Best Practices

1. **Use separate databases**
   - DB 0: Main application
   - DB 1: Parser cache
   - DB 2: Session store
   - etc.

2. **Set memory limits**
   ```bash
   # In redis.conf or via CONFIG SET
   maxmemory 100mb
   maxmemory-policy allkeys-lru  # Remove least recently used keys
   ```

3. **Enable persistence (for production)**
   ```bash
   # In redis.conf
   save 900 1     # Save after 900 sec if at least 1 key changed
   save 300 10    # Save after 300 sec if at least 10 keys changed
   save 60 10000  # Save after 60 sec if at least 10000 keys changed
   ```

4. **Monitor memory usage**
   ```bash
   redis-cli INFO memory
   ```

## Environment Variables

Create a `.env` file in your parser directory:

```env
# For local Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1
REDIS_ENABLED=true

# OR for cloud Redis (simpler)
REDIS_URL=redis://your-cloud-redis-url
REDIS_ENABLED=true

# Cache settings
CACHE_TTL=3600  # 1 hour default
CACHE_ADMIN_KEY=your-secret-key
```

## Verify Everything Works

```bash
# Run the Redis caching test
node test-redis-caching.js

# Check health endpoint
curl http://localhost:3001/health | jq .checks.redis

# Check metrics
curl http://localhost:3001/metrics | jq .cache
```

## Troubleshooting

### Redis connection refused
- Check Redis is running: `redis-cli ping`
- Check firewall/security groups for cloud Redis
- Verify credentials in .env file

### High memory usage
- Clear old cache: `redis-cli FLUSHDB`
- Reduce TTL in cache settings
- Implement memory limits

### Slow cache performance
- Check network latency to Redis server
- Consider using local Redis for development
- Use Redis Cloud with region close to your server