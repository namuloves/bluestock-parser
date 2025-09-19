#!/bin/bash

# Redis Management Commands for Bluestock Parser

echo "🔴 Redis Management for Bluestock Parser"
echo "========================================"

case "$1" in
  "status")
    echo "📊 Redis Status:"
    redis-cli -n 1 INFO server | grep -E "redis_version|uptime_in_seconds"
    echo ""
    echo "📦 Cache Statistics:"
    redis-cli -n 1 DBSIZE
    redis-cli -n 1 INFO stats | grep -E "keyspace_hits|keyspace_misses"
    ;;

  "monitor")
    echo "👁  Monitoring Redis activity (Ctrl+C to stop):"
    redis-cli -n 1 MONITOR
    ;;

  "keys")
    echo "🔑 Parser cache keys:"
    redis-cli -n 1 KEYS "parser:*" | head -20
    echo ""
    redis-cli -n 1 DBSIZE
    ;;

  "clear")
    echo "🧹 Clearing parser cache..."
    redis-cli -n 1 --scan --pattern "parser:*" | xargs -L 1 redis-cli -n 1 DEL
    echo "✅ Cache cleared"
    redis-cli -n 1 DBSIZE
    ;;

  "clear-site")
    if [ -z "$2" ]; then
      echo "❌ Usage: ./redis-commands.sh clear-site <domain>"
      exit 1
    fi
    echo "🧹 Clearing cache for $2..."
    redis-cli -n 1 --scan --pattern "parser:*$2*" | xargs -L 1 redis-cli -n 1 DEL
    echo "✅ Cache cleared for $2"
    ;;

  "memory")
    echo "💾 Memory usage:"
    redis-cli -n 1 INFO memory | grep -E "used_memory_human|used_memory_peak_human"
    ;;

  "top")
    echo "🔝 Top 10 largest keys:"
    redis-cli -n 1 --bigkeys
    ;;

  "ttl")
    if [ -z "$2" ]; then
      echo "⏰ Showing TTL for first 5 keys:"
      for key in $(redis-cli -n 1 KEYS "parser:*" | head -5); do
        ttl=$(redis-cli -n 1 TTL "$key")
        echo "  $key: $ttl seconds"
      done
    else
      ttl=$(redis-cli -n 1 TTL "$2")
      echo "TTL for $2: $ttl seconds"
    fi
    ;;

  "get")
    if [ -z "$2" ]; then
      echo "❌ Usage: ./redis-commands.sh get <url>"
      exit 1
    fi
    # Convert URL to cache key format
    key="parser:v3:${2//www./}"
    redis-cli -n 1 GET "$key" | python3 -m json.tool | head -50
    ;;

  *)
    echo "Usage: ./redis-commands.sh {status|monitor|keys|clear|clear-site|memory|top|ttl|get}"
    echo ""
    echo "Commands:"
    echo "  status      - Show Redis status and cache statistics"
    echo "  monitor     - Monitor Redis activity in real-time"
    echo "  keys        - List parser cache keys"
    echo "  clear       - Clear all parser cache"
    echo "  clear-site  - Clear cache for specific site (e.g., clear-site uniqlo.com)"
    echo "  memory      - Show memory usage"
    echo "  top         - Show largest keys"
    echo "  ttl [key]   - Show TTL (time to live) for keys"
    echo "  get <url>   - Get cached data for a URL"
    ;;
esac