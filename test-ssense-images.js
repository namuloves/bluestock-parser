const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function test() {
  const username = encodeURIComponent(process.env.DECODO_USERNAME || 'spubcuhdc9');
  const password = encodeURIComponent(process.env.DECODO_PASSWORD || 'nTDf2hlhI96r=eaNk4');
  const proxyUrl = `http://${username}:${password}@gate.decodo.com:10001`;
  
  console.log('Fetching SSENSE page via proxy...');
  const response = await axios.get('https://www.ssense.com/en-us/women/product/still-kelly/black-workwear-trousers/18061791', {
    httpsAgent: new HttpsProxyAgent(proxyUrl),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  
  const html = response.data;
  console.log('HTML length:', html.length);
  
  // Look for different image patterns
  const patterns = [
    /data-srcset="([^"]*)"/g,
    /srcset="([^"]*)"/g,
    /data-src="([^"]*\.jpg[^"]*)"/g,
    /src="([^"]*ssensemedia[^"]*)"/g,
    /"https:\/\/img\.ssensemedia\.com\/images\/[^"]+"/g
  ];
  
  const images = new Set();
  
  // Check JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data.image) {
        images.add(data.image);
        console.log('JSON-LD image:', data.image);
      }
    } catch (e) {}
  }
  
  // Check all patterns
  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const content = match[1] || match[0];
      if (content.includes('ssensemedia')) {
        // Handle srcset format
        if (content.includes(',')) {
          const urls = content.split(',').map(s => s.trim().split(' ')[0]);
          urls.forEach(url => {
            if (url.includes('.jpg')) {
              images.add(url.replace(/^"|"$/g, '').split('?')[0]);
            }
          });
        } else if (content.includes('.jpg')) {
          images.add(content.replace(/^"|"$/g, '').split('?')[0]);
        }
      }
    }
  }
  
  // Also check for image URLs in JavaScript
  const jsImagePattern = /['"]https:\/\/img\.ssensemedia\.com\/images\/[^'"]+\.jpg[^'"]*/g;
  const jsMatches = html.match(jsImagePattern) || [];
  jsMatches.forEach(url => {
    images.add(url.replace(/^['"]|['"]$/g, '').split('?')[0]);
  });
  
  console.log('\nFound', images.size, 'unique images:');
  const imageArray = Array.from(images);
  imageArray.forEach((img, i) => console.log(`${i+1}. ${img}`));
  
  // Check if images are in specific containers
  console.log('\nChecking for gallery structure...');
  const hasGallery = html.includes('pdp-gallery') || html.includes('product-gallery');
  const hasCarousel = html.includes('carousel') || html.includes('swiper');
  console.log('Has gallery:', hasGallery);
  console.log('Has carousel:', hasCarousel);
}

test().catch(console.error);