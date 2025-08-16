# Size Chart Parser API Documentation

## Overview
Enhanced size chart extraction service that uses Puppeteer to handle JavaScript-rendered content, modal popups, and various size chart formats.

## Endpoint

### POST /parse-size-chart

Extracts size chart data from a product page URL.

**Request Body:**
```json
{
  "url": "https://example.com/product-page",
  "timeout": 30000  // Optional, in milliseconds (default: 30000)
}
```

**Response:**

Success with table data:
```json
{
  "success": true,
  "data": {
    "type": "table",
    "headers": ["Size", "Chest", "Waist", "Length"],
    "rows": [
      ["S", "36", "30", "28"],
      ["M", "38", "32", "29"],
      ["L", "40", "34", "30"]
    ],
    "unit": "inches"
  }
}
```

Success with image data:
```json
{
  "success": true,
  "data": {
    "type": "image",
    "image_url": "base64_encoded_image_or_url",
    "alt_text": "Size chart description"
  }
}
```

Success with measurements data:
```json
{
  "success": true,
  "data": {
    "type": "measurements",
    "data": {
      "S": {"chest": 36, "waist": 30},
      "M": {"chest": 38, "waist": 32}
    },
    "unit": "inches"
  }
}
```

No size chart found:
```json
{
  "success": false,
  "message": "No size chart found on this page",
  "data": null
}
```

## Features

### Multi-Strategy Extraction
1. **Modal/Popup Detection**: Clicks "Size Guide" buttons and extracts content from modals
2. **Table Extraction**: Parses HTML tables containing size information
3. **Structured Data**: Extracts from JSON-LD, microdata, and script tags
4. **Text Pattern Matching**: Identifies measurements in product descriptions
5. **Image Capture**: Screenshots size chart images when tables aren't available

### Site-Specific Handlers
- Shopify stores (detects Shopify-specific size chart apps)
- WooCommerce sites (handles tabbed content)
- Platform detection for optimized extraction

### Anti-Bot Measures
- Stealth mode configuration
- Realistic user agent strings
- Viewport and browser fingerprint spoofing
- Graceful handling of navigation timeouts

## Integration Example

```javascript
const axios = require('axios');

async function getSizeChart(productUrl) {
  try {
    const response = await axios.post('http://your-railway-url/parse-size-chart', {
      url: productUrl,
      timeout: 45000
    });
    
    if (response.data.success && response.data.data) {
      const sizeChart = response.data.data;
      
      switch(sizeChart.type) {
        case 'table':
          // Display table with headers and rows
          console.log('Size chart table:', sizeChart.headers, sizeChart.rows);
          break;
          
        case 'image':
          // Display or save the image
          console.log('Size chart image:', sizeChart.image_url);
          break;
          
        case 'measurements':
          // Process measurements data
          console.log('Size measurements:', sizeChart.data);
          break;
      }
      
      return sizeChart;
    } else {
      console.log('No size chart found');
      return null;
    }
    
  } catch (error) {
    console.error('Failed to get size chart:', error);
    return null;
  }
}
```

## Testing

Test the endpoint with the included mock file:
```bash
node test-mock.js
```

Test with real product URLs:
```bash
node test-size-chart-basic.js
```

## Limitations

- Some sites with aggressive anti-bot protection may block Puppeteer
- Sites requiring login to view size charts are not supported
- Dynamic size charts that load based on specific product variants may require additional implementation
- Response time depends on page load speed and complexity (typically 5-15 seconds)

## Deployment Notes

For Railway deployment:
1. Puppeteer requires additional dependencies in production
2. Memory usage can be high due to headless browser
3. Consider implementing request queuing for high traffic
4. Browser instances are reused for efficiency but cleaned up on server shutdown