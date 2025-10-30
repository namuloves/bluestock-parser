const puppeteer = require('puppeteer');

async function debugBespokePost() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Extract all the image data from BP.CacheManager
  const allImageData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content && content.includes('BP.CacheManager.set("Product.cache')) {
        // Find the start of the JSON object
        const startIdx = content.indexOf('{', content.indexOf('Product.cache'));
        if (startIdx === -1) return null;

        // Find matching closing brace
        let depth = 0;
        let inString = false;
        let stringChar = null;
        let endIdx = -1;

        for (let i = startIdx; i < content.length; i++) {
          const char = content[i];

          if (!inString) {
            if (char === '"' || char === "'") {
              inString = true;
              stringChar = char;
            } else if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0) {
                endIdx = i;
                break;
              }
            }
          } else {
            if (char === '\\') {
              i++; // Skip next char
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
            return { error: e.message };
          }
        }
      }
    }
    return null;
  });

  if (allImageData && allImageData.images) {
    console.log('📸 TOTAL IMAGES IN BP CACHE:', allImageData.images.length);
    console.log('\n🔍 ALL IMAGES:');

    allImageData.images.forEach((img, i) => {
      console.log(`\n${i + 1}. Image ${i + 1}:`);
      console.log('   Kind:', img.kind);
      console.log('   Desktop UID:', img.desktop_image_uid);
      console.log('   Mobile UID:', img.mobile_image_uid);

      if (img.desktop_image_uid) {
        console.log('   Full URL:', `https://dam.bespokepost.com/image/upload/${img.desktop_image_uid}`);
      }

      // Check what kind of image this is
      if (img.kind === 'product-image') {
        console.log('   ✅ THIS IS A PRODUCT IMAGE');
      } else {
        console.log('   ❌ Not a product image (kind: ' + img.kind + ')');
      }
    });

    // Count product images
    const productImages = allImageData.images.filter(img => img.kind === 'product-image');
    console.log('\n📊 SUMMARY:');
    console.log('Total images:', allImageData.images.length);
    console.log('Product images:', productImages.length);
    console.log('Other images:', allImageData.images.length - productImages.length);
  } else {
    console.log('❌ Could not find image data');
  }

  // Also check for images in the HTML directly
  const htmlImages = await page.evaluate(() => {
    const images = [];

    // Check div.u-product-image-prominent-hidden images
    document.querySelectorAll('div.u-product-image-prominent-hidden img').forEach(img => {
      images.push({
        src: img.src,
        class: img.className,
        parent: 'u-product-image-prominent-hidden'
      });
    });

    // Check bp-responsive-background-image divs
    document.querySelectorAll('div[class*="bp-responsive-background-image"]').forEach(div => {
      images.push({
        style: div.getAttribute('style'),
        class: div.className,
        parent: 'bp-responsive-background-image'
      });
    });

    return images;
  });

  console.log('\n\n🌐 HTML IMAGES:');
  htmlImages.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img.parent}`);
    if (img.src) console.log('   src:', img.src);
    if (img.style) console.log('   style:', img.style);
  });

  await browser.close();
}

debugBespokePost().catch(console.error);