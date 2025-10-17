# Universal Parser V3 → Lean Implementation Migration

## 🚨 Current Problems
- **3 parser versions** running simultaneously (V1, V2-enhanced, V3)
- **Confidence scores** used everywhere (0.5, 0.7 thresholds)
- **pattern-db.json** growing uncontrolled (auto-learning)
- **Browser rendering** for 50+ hardcoded sites
- **No validation** - just confidence guessing

## 📋 Migration Priority Order

### Phase 1: Quality Gate (Week 1)
**Goal**: Replace confidence with pass/fail validation

1. **Create Product Schema** (`/schemas/product.json`)
   ```javascript
   // Required: name, price, images[0]
   // Validation: price > 0, name.length > 2
   // No placeholders, valid URLs
   ```

2. **Add Quality Gate to server.js**
   ```javascript
   // Replace: if (confidence > 0.5)
   // With: try { validateProduct(data) } catch { fallback }
   ```

3. **Remove confidence from response**
   - Keep working but ignore the value
   - Log pass/fail instead of confidence

**Files to modify**:
- Create: `/schemas/product.json`
- Create: `/utils/qualityGate.js`
- Modify: `server.js` (lines 411-412)

### Phase 2: Kill Auto-Learning (Week 1)
**Goal**: Stop pattern-db.json corruption

1. **Disable all learning**
   ```javascript
   // Set: ENABLE_PATTERN_LEARNING=false
   // Comment out: learnFromSuccess(), savePatterns()
   ```

2. **Create static recipes** (`/recipes/`)
   ```yaml
   # /recipes/zara.com.yml
   selectors:
     name: h1.product-detail-info__header-name
     price: .product-price-current
   assertions:
     - price > 0
   ```

3. **Version control recipes**
   - Remove pattern-db.json from .gitignore
   - Freeze current patterns as v1

**Files to modify**:
- Disable: `learnFromSuccess()` in 4 files
- Create: `/recipes/` directory with YAML files
- Delete: Auto-write to pattern-db.json

### Phase 3: Smart Rendering (Week 2)
**Goal**: Stop wasting money on rendering

1. **Page Type Detector**
   ```javascript
   // Detect: product vs listing vs article
   // Check: React/Vue/Next markers
   // Decision: render only if (SPA && product && no data)
   ```

2. **Remove hardcoded site lists**
   - Delete: `requiresBrowser` array (50+ sites)
   - Delete: `maybeBrowser` array
   - Use detection instead

3. **Add render budget**
   ```yaml
   # /policies/domains.yml
   defaults:
     render_budget: 100/hour
   ```

**Files to modify**:
- Create: `/utils/renderPolicy.js`
- Modify: `universal-parser-enhanced.js` (lines 36-60)

### Phase 4: Plugin Architecture (Week 2)
**Goal**: Clean extraction pipeline

1. **Convert strategies to plugins**
   ```javascript
   class JsonLdPlugin { extract($) }
   class RecipePlugin { extract($, domain) }
   class MicrodataPlugin { extract($) }
   ```

2. **Deterministic merge**
   - First valid value wins
   - No scoring, no confidence
   - Track source for debugging

**Files to modify**:
- Create: `/plugins/` directory
- Refactor: extraction strategies

### Phase 5: Domain Policies (Week 3)
**Goal**: Per-site control

1. **Policy configuration**
   ```yaml
   zara.com:
     timeout: 3000
     rate_limit: 5/sec
     render: false
   ```

2. **Circuit breakers**
   - Fail 5x → skip for 60s
   - Per-domain tracking

**Files to modify**:
- Create: `/policies/domains.yml`
- Create: `/utils/domainPolicy.js`

### Phase 6: Golden Testing (Week 3)
**Goal**: Prevent regressions

1. **Create test dataset**
   - 50-100 product URLs
   - Include Fred Home
   - Expected values

2. **CI integration**
   ```json
   "scripts": {
     "test:golden": "node test/golden-test.js",
     "precommit": "npm run test:golden"
   }
   ```

3. **Block deploys if <95% pass**

**Files to create**:
- `/test/golden-products.json`
- `/test/golden-test.js`

## 🎯 Quick Wins (Do Today)

### 1. Set environment variable
```bash
export ENABLE_PATTERN_LEARNING=false
```

### 2. Add basic validation
```javascript
// In server.js line 411
if (v3Result && v3Result.price > 0 && v3Result.name) {
  // Use result
}
```

### 3. Log confidence removal plan
```javascript
console.log(`[DEPRECATION] confidence: ${v3Result.confidence} will be removed`);
```

### 4. Create recipes directory
```bash
mkdir recipes
cp pattern-db.json recipes/backup-patterns.json
```

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Parser versions | 3 | 1 |
| Confidence usage | Everywhere | None |
| Pattern learning | Auto | Static recipes |
| Render rate | ~80% | <20% |
| Pass/fail validation | 0% | 100% |
| Golden test coverage | 0 | 100 URLs |
| Code complexity | 1000+ lines | <500 lines |

## ⚠️ Don't Break Production

### Safe removal order:
1. Stop learning (safe)
2. Add validation alongside confidence (safe)
3. Log deprecation warnings (safe)
4. Switch to validation in shadow mode (safe)
5. Remove confidence checks (needs testing)
6. Delete old parsers (after 2 weeks stable)

### Rollback plan:
```javascript
// Emergency switches
ENABLE_LEAN_PARSER=false  // Use old parser
ENABLE_PATTERN_LEARNING=true  // Re-enable if needed
USE_CONFIDENCE=true  // Restore confidence checks
```

## 🚀 End State

**Before**: 3 parsers, confidence guessing, auto-learning chaos
**After**: 1 parser, hard validation, versioned recipes, smart rendering

**Deleted**:
- `calculateConfidence()` function
- Auto-learning code
- Hardcoded site lists
- 500+ lines of complexity

**Added**:
- JSON Schema validation
- YAML selector recipes
- Page type detection
- Circuit breakers
- Golden tests