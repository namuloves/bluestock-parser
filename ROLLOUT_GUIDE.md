# 🚀 Lean Parser Gradual Rollout Guide

## Overview

This guide explains how to gradually roll out the lean parser to production, replacing the V3 parser safely over 2-3 weeks.

## Current Status

- **V3 Parser**: Currently handling all traffic (legacy system with confidence scores)
- **Lean Parser**: Ready for production (deterministic validation, plugins, recipes)
- **Rollout System**: Implemented and ready to use

## Rollout Phases

### Phase 1: Shadow Mode (Week 1) ✅ COMPLETED
- Run both parsers in parallel
- Compare results but don't use lean parser output
- Monitor for discrepancies

### Phase 2: Trusted Domains (Week 2) 🟡 CURRENT
**Configuration:**
```bash
LEAN_ROLLOUT_MODE=trusted_only
```

**What happens:**
- Lean parser handles: zara.com, hm.com, nordstrom.com, asos.com, cos.com, uniqlo.com
- V3 parser handles: all other domains
- No fallback mechanism yet

**Success criteria:**
- >95% success rate on trusted domains
- <5s average parse time
- No customer complaints

### Phase 3: Percentage Rollout (Week 2.5)
**Configuration:**
```bash
LEAN_ROLLOUT_MODE=percentage
LEAN_PARSER_PERCENTAGE=20  # Start with 20%
```

**What happens:**
- Lean parser handles: trusted domains + 20% random traffic
- Monitor and gradually increase percentage (20% → 40% → 60% → 80%)

**Success criteria:**
- >90% success rate overall
- Stable performance metrics

### Phase 4: Primary with Fallback (Week 3)
**Configuration:**
```bash
LEAN_ROLLOUT_MODE=primary_with_fallback
```

**What happens:**
- Lean parser tries first for ALL domains
- If lean fails, automatically fallback to V3
- Track fallback rate

**Success criteria:**
- <10% fallback rate
- >95% overall success rate

### Phase 5: Full Migration (Week 4)
**Configuration:**
```bash
LEAN_ROLLOUT_MODE=full
PARSER_VERSION=lean
```

**What happens:**
- Lean parser handles 100% of traffic
- V3 parser can be removed
- Celebrate! 🎉

## API Endpoints

### Monitor Rollout Status
```bash
curl http://localhost:3001/api/rollout/status
```

### Get Detailed Metrics
```bash
curl http://localhost:3001/api/rollout/metrics
```

### Update Configuration
```bash
# Change mode
curl -X POST http://localhost:3001/api/rollout/config \
  -H "Content-Type: application/json" \
  -d '{"mode": "percentage", "percentage": 20}'

# Add trusted domain
curl -X POST http://localhost:3001/api/rollout/config \
  -H "Content-Type: application/json" \
  -d '{"addDomain": "example.com"}'
```

### Reset Metrics
```bash
curl -X POST http://localhost:3001/api/rollout/reset
```

## Testing

### Run rollout tests
```bash
node test-gradual-rollout.js
```

### Test specific domain
```bash
# Check which parser will be used
curl http://localhost:3001/api/rollout/status

# Test parse
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.zara.com/product"}'
```

## Monitoring Dashboard

Key metrics to watch:
1. **Lean Parser Usage Rate**: Should match your configuration
2. **Lean Success Rate**: Target >95%
3. **Fallback Rate**: Should be <10% in fallback mode
4. **Parse Time**: Lean should be faster (target <2s without render, <10s with)
5. **Domain-specific failures**: May need new recipes

## Rollback Procedure

If issues arise at any phase:

### Quick rollback (immediate)
```bash
# Disable lean parser completely
LEAN_ROLLOUT_MODE=disabled

# Or revert to previous phase
LEAN_ROLLOUT_MODE=trusted_only
```

### Full rollback (if needed)
```bash
# Use V3 parser only
PARSER_VERSION=v3
LEAN_ROLLOUT_MODE=disabled
```

## Troubleshooting

### High failure rate on specific domain
1. Check if domain needs a recipe: `/recipes/{domain}.yml`
2. Check render policy: some SPAs need rendering
3. Add to never-use-lean list temporarily

### Lean parser slower than V3
1. Check if unnecessary rendering is happening
2. Verify circuit breakers aren't triggering
3. Check plugin execution order

### Memory/CPU issues
1. Both parsers running uses more memory
2. Consider increasing server resources during rollout
3. After full migration, resources will decrease

## Success Metrics

### Week 2 (Trusted Domains)
- [ ] 6+ trusted domains using lean parser
- [ ] >95% success rate on trusted domains
- [ ] <5% performance degradation
- [ ] Zero customer complaints

### Week 3 (Primary with Fallback)
- [ ] Lean parser handling >80% of traffic
- [ ] <10% fallback rate
- [ ] >95% overall success rate
- [ ] 50% reduction in rendering costs

### Week 4 (Full Migration)
- [ ] 100% traffic on lean parser
- [ ] V3 parser code removed
- [ ] 75% reduction in rendering costs
- [ ] 90% reduction in parser failures

## Commands Reference

```bash
# Start server with rollout
LEAN_ROLLOUT_MODE=trusted_only npm start

# Test rollout
node test-gradual-rollout.js

# Monitor in real-time
watch -n 5 'curl -s http://localhost:3001/api/rollout/metrics | jq .summary'

# Check recommendations
curl http://localhost:3001/api/rollout/metrics | jq .recommendations
```

## Post-Migration Cleanup

Once fully migrated to lean parser:

1. Delete V3 parser files:
   - `universal-parser-v3.js`
   - `universal-parser-v3-cached.js`
   - `universal-parser-v2.js`

2. Remove confidence score code:
   - `calculateConfidence()` functions
   - Confidence thresholds (0.5, 0.7)
   - Auto-learning code

3. Clean up configuration:
   - Remove `PARSER_VERSION` checks
   - Remove rollout configuration
   - Simplify to just lean parser

4. Update documentation:
   - Remove references to V3
   - Update API docs
   - Archive migration guides

## Contact

For issues during rollout:
1. Check metrics: `/api/rollout/metrics`
2. Review logs for parser decisions
3. Test with: `test-gradual-rollout.js`
4. Rollback if needed: `LEAN_ROLLOUT_MODE=disabled`

---

*Last Updated: January 2025*
*Lean Parser Version: v4.0.0-lean*
*Rollout System Version: 1.0.0*