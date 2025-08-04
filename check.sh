#!/bin/bash

# RULE CHECKER - Run this before ANY changes

echo "🔍 RULE CHECK - STOP AND TEST FIRST"
echo "===================================="

# 1. Check current state
echo "📌 Step 1: Testing current Railway state..."
RESPONSE=$(curl -s -X POST "https://bluestock-parser.up.railway.app/scrape" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.ssense.com/en-us/women/product/still-kelly/black-workwear-trousers/18061791"}')

SUCCESS=$(echo $RESPONSE | python3 -c "import json, sys; print(json.load(sys.stdin).get('success', False))")
PRODUCT_NAME=$(echo $RESPONSE | python3 -c "import json, sys; print(json.load(sys.stdin).get('product', {}).get('product_name', 'FAILED'))")
IMAGE_COUNT=$(echo $RESPONSE | python3 -c "import json, sys; print(len(json.load(sys.stdin).get('product', {}).get('image_urls', [])))")

echo "✅ Current state:"
echo "   - Success: $SUCCESS"
echo "   - Product: $PRODUCT_NAME"
echo "   - Images: $IMAGE_COUNT"

# 2. Check for uncommitted changes
echo ""
echo "📌 Step 2: Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    echo "❌ ERROR: You have uncommitted changes!"
    echo "   Choose ONE thing to change:"
    git status -s
    echo ""
    echo "🛑 STOP: Commit or stash changes before continuing"
    exit 1
else
    echo "✅ Working directory clean"
fi

# 3. Test locally if making changes
echo ""
echo "📌 Step 3: Local test reminder"
echo "Before pushing ANY changes, run:"
echo ""
echo "USE_PROXY=true node -e \"const {scrapeSsense} = require('./scrapers/ssense'); scrapeSsense('https://www.ssense.com/...').then(console.log)\""
echo ""

# 4. Show last working version
echo "📌 Step 4: Last 5 commits"
git log --oneline -5

echo ""
echo "📌 Step 5: Rules reminder"
echo "1. ONE change at a time"
echo "2. Test locally BEFORE pushing" 
echo "3. Read actual error messages"
echo "4. Tag working versions"
echo ""

# 5. Ask for confirmation
read -p "Have you tested your changes locally? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ STOP: Test locally first!"
    echo "Run: npm test or node test-ssense.js"
    exit 1
fi

echo "✅ Proceed with caution - remember you're a stupid son of a bitch if you don't test"