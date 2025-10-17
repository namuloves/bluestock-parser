# 🔄 FALLBACK MODE ACTIVE

## Current Configuration

The parser is now running in **`primary_with_fallback`** mode, which means:

1. **Lean parser tries first** for ALL domains
2. **Automatic fallback to V3** if lean parser fails
3. **Both parsers are loaded** and ready to handle requests

## How It Works

```
Request → Lean Parser → Success? → Return result
             ↓
           Failure
             ↓
         V3 Parser → Success? → Return result
             ↓
           Failure
             ↓
        Legacy Scraper
```

## Benefits

- ✅ **Maximum compatibility** - Nothing breaks, V3 catches lean failures
- ✅ **Gradual learning** - See which domains need recipes
- ✅ **Safe testing** - Production-ready with safety net
- ✅ **Performance tracking** - Compare both parsers in real usage

## Monitor Performance

### Check current status:
```bash
curl http://localhost:3001/api/rollout/status | jq .
```

### View metrics:
```bash
curl http://localhost:3001/api/rollout/metrics | jq .summary
```

### Test fallback behavior:
```bash
node test-fallback-mode.js
```

## Key Metrics to Watch

- **Fallback Rate**: How often V3 is needed (target: <10%)
- **Lean Success Rate**: Direct success without fallback (target: >90%)
- **Parse Time**: Should be faster with lean parser
- **Domain Failures**: Which sites need recipes

## When to Move to Full Lean Mode

Move to full lean parser when:
- Fallback rate is consistently <5%
- Lean success rate is >95%
- All major domains have recipes
- Performance is stable for 24-48 hours

To switch to full lean mode:
```bash
# Set in .env or environment
LEAN_ROLLOUT_MODE=full
PARSER_VERSION=lean
```

## Quick Actions

### If too many fallbacks:
1. Check which domains are failing: `curl http://localhost:3001/api/rollout/metrics | jq .detailed.byDomain`
2. Add recipes for failing domains
3. Consider keeping some domains on V3 longer

### If performance degrades:
```bash
# Immediate rollback to V3 only
LEAN_ROLLOUT_MODE=disabled
```

### To add more trusted domains:
```bash
curl -X POST http://localhost:3001/api/rollout/config \
  -H "Content-Type: application/json" \
  -d '{"addDomain": "example.com"}'
```

## Current Trusted Domains

These domains have recipes and should work well with lean parser:
- zara.com
- hm.com
- nordstrom.com
- asos.com
- cos.com
- uniqlo.com

## Next Steps

1. **Monitor for 24-48 hours** in fallback mode
2. **Add recipes** for domains with high fallback rates
3. **Move to full lean mode** when metrics are stable
4. **Remove V3 parser** after successful full migration

---

*Mode activated: January 2025*
*Safe fallback ensures zero downtime during migration*