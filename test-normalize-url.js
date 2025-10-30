// Simulate the getNormalizedImageBase function
const getNormalizedImageBase = (url) => {
  if (!url) return null;

  console.log('Normalizing:', url);

  try {
    // Handle protocol-relative URLs
    let normalizedUrl = url;
    if (url.startsWith('//')) {
      normalizedUrl = 'https:' + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Relative URL - shouldn't happen for product images but handle it
      console.log('  Rejected: relative URL');
      return null;
    }

    // Parse the URL to get the pathname
    const urlObj = new URL(normalizedUrl);
    let pathname = urlObj.pathname;

    // Remove Shopify size suffixes like _1200x1200, _4000x, _grande, _large, etc.
    pathname = pathname.replace(/_\d+x\d*\./, '.');  // _1200x1200.jpg -> .jpg
    pathname = pathname.replace(/_\d+x\./, '.');      // _4000x.jpg -> .jpg
    pathname = pathname.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master)\./, '.');

    // Return normalized base (pathname + version param if exists)
    const vParam = urlObj.searchParams.get('v');
    const result = pathname + (vParam ? `?v=${vParam}` : '');
    console.log('  Normalized base:', result);
    return result;
  } catch (e) {
    // Invalid URL, skip it
    console.log('  Error:', e.message);
    return null;
  }
};

// Test with both URLs
const url1 = 'http://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_1200x1200.jpg?v=1761232061';
const url2 = 'https://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_4000x.jpg?v=1761232061';

const base1 = getNormalizedImageBase(url1);
const base2 = getNormalizedImageBase(url2);

console.log('\nComparison:');
console.log('Base 1:', base1);
console.log('Base 2:', base2);
console.log('Are they the same?', base1 === base2);