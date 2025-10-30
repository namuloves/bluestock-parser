const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function findRealZaraImages() {
  const url = 'https://www.zara.com/us/en/sporty-ballet-flats-with-bow-p15205610.html';

  console.log('🔍 Visiting Zara page to find real image URLs...');
  console.log('URL:', url);
  console.log('---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Enable request interception to log all image requests
    await page.setRequestInterception(true);

    const imageRequests = new Set();

    page.on('request', (request) => {
      const url = request.url();
      if (request.resourceType() === 'image' || url.includes('.jpg') || url.includes('.webp') || url.includes('.png')) {
        imageRequests.add(url);
      }
      request.continue();
    });

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for images to load
    await page.waitForTimeout(5000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(2000);

    // Extract images from the DOM
    const domImages = await page.evaluate(() => {
      const images = new Set();

      // Method 1: All img tags
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.currentSrc;
        if (src && (src.includes('.jpg') || src.includes('.webp') || src.includes('.png'))) {
          images.add(src);
        }
      });

      // Method 2: Picture elements
      document.querySelectorAll('picture source').forEach(source => {
        const srcset = source.srcset;
        if (srcset) {
          const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            if (url && (url.includes('.jpg') || url.includes('.webp') || url.includes('.png'))) {
              images.add(url.startsWith('http') ? url : `https://www.zara.com${url}`);
            }
          });
        }
      });

      // Method 3: Background images
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const style = el.getAttribute('style');
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match && match[1]) {
          const url = match[1];
          if (url.includes('.jpg') || url.includes('.webp') || url.includes('.png')) {
            images.add(url.startsWith('http') ? url : `https://www.zara.com${url}`);
          }
        }
      });

      return Array.from(images);
    });

    console.log('\n📸 Images found from network requests:');
    console.log('Total:', imageRequests.size);
    const networkImages = Array.from(imageRequests).filter(url =>
      url.includes('static.zara.net') &&
      (url.includes('.jpg') || url.includes('.webp') || url.includes('.png'))
    );
    networkImages.slice(0, 5).forEach(url => {
      console.log('  -', url.substring(0, 150));
    });

    console.log('\n📸 Images found in DOM:');
    console.log('Total:', domImages.length);
    domImages.slice(0, 5).forEach(url => {
      console.log('  -', url.substring(0, 150));
    });

    // Test if the images are accessible
    console.log('\n🧪 Testing image accessibility:');
    for (const url of [...networkImages.slice(0, 3), ...domImages.slice(0, 3)]) {
      if (!url || !url.startsWith('http')) continue;

      try {
        const response = await page.evaluate(async (imageUrl) => {
          try {
            const resp = await fetch(imageUrl, { method: 'HEAD' });
            return { status: resp.status, ok: resp.ok };
          } catch (e) {
            return { error: e.message };
          }
        }, url);

        console.log(`  ${response.ok ? '✅' : '❌'} ${url.substring(0, 100)}... - Status: ${response.status || response.error}`);
      } catch (e) {
        console.log(`  ❌ ${url.substring(0, 100)}... - Error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

findRealZaraImages();