const puppeteer = require('puppeteer');

async function inspectBespokePostImages() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Extract the BP.CacheManager product data
  const productData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content && content.includes('BP.CacheManager') && content.includes('Product.cache')) {
        // Find the product cache data more carefully
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('BP.CacheManager.set("Product.cache')) {
            // Extract the JSON object from this line and potentially following lines
            const startIdx = content.indexOf('{', content.indexOf('Product.cache', content.indexOf('BP.CacheManager.set')));
            if (startIdx !== -1) {
              // Find matching closing brace
              let depth = 0;
              let inString = false;
              let stringChar = null;
              let endIdx = -1;

              for (let j = startIdx; j < content.length; j++) {
                const char = content[j];

                if (!inString) {
                  if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                  } else if (char === '{') {
                    depth++;
                  } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                      endIdx = j;
                      break;
                    }
                  }
                } else {
                  if (char === '\\') {
                    j++; // Skip next char
                  } else if (char === stringChar) {
                    inString = false;
                  }
                }
              }

              if (endIdx !== -1) {
                const jsonStr = content.substring(startIdx, endIdx + 1);
                try {
                  return JSON.parse(jsonStr);
                } catch (e) {
                  console.error('Failed to parse:', e.message);
                  return null;
                }
              }
            }
          }
        }
      }
    }
    return null;
  });

  if (productData) {
    console.log('🔍 Product Data Images:');
    console.log('Total images in array:', productData.images?.length || 0);
    console.log('\n📸 All image entries:');

    productData.images?.forEach((img, i) => {
      console.log(`\n${i + 1}. Kind: ${img.kind}`);
      console.log(`   Desktop UID: ${img.desktop_image_uid || 'N/A'}`);
      console.log(`   Mobile UID: ${img.mobile_image_uid || 'N/A'}`);

      if (img.kind === 'product-image' && img.desktop_image_uid) {
        console.log(`   ✅ URL: https://dam.bespokepost.com/image/upload/${img.desktop_image_uid}`);
      } else {
        console.log(`   ❌ Filtered out (kind: ${img.kind})`);
      }
    });

    console.log('\n\n📦 Default Image:');
    if (productData.default_image) {
      console.log('Desktop UID:', productData.default_image.desktop_image_uid);
      console.log('URL:', `https://dam.bespokepost.com/image/upload/${productData.default_image.desktop_image_uid}`);
    }
  } else {
    console.log('❌ Could not find product cache data');
  }

  await browser.close();
}

inspectBespokePostImages().catch(console.error);
