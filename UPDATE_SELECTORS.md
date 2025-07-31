# How to Update Selectors When Sites Change

## Ralph Lauren Selectors

If Ralph Lauren changes their HTML structure and images stop being scraped, update the selectors in:
`/config/ralph-lauren-selectors.js`

### To find new selectors:

1. **Visit a Ralph Lauren product page**
2. **Right-click on a product image** → Inspect Element
3. **Look for the container class** (like `ghosting-main`)
4. **Add it to the `imageContainers` array**

### Example:
If Ralph Lauren changes from `.ghosting-main` to `.product-gallery-new`:

```javascript
imageContainers: [
  '.product-gallery-new',      // Add new container at the top
  '.ghosting-main',           // Keep old ones as fallback
  '.product-images-main',
  // ... rest
]
```

### Testing Changes:
```bash
node -e "
const { scrapeRalphLauren } = require('./scrapers/ralphlauren');
scrapeRalphLauren('YOUR_TEST_URL').then(r => {
  console.log('Images found:', r.images?.length || 0);
  console.log('First image:', r.images?.[0]);
});
"
```

## Other Sites

Similar selector files can be created for:
- Nordstrom: `/config/nordstrom-selectors.js`
- Sezane: `/config/sezane-selectors.js`
- COS: `/config/cos-selectors.js`

This approach makes the scrapers maintainable without changing core logic!