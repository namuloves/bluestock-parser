const testUrl = 'http://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_1200x1200.jpg?v=1761232061';

try {
  const urlObj = new URL(testUrl);
  console.log('✅ URL parsed successfully');
  console.log('Pathname:', urlObj.pathname);
  console.log('Search params:', urlObj.search);

  // Test the normalization
  let pathname = urlObj.pathname;
  pathname = pathname.replace(/_\d+x\d*\./, '.');  // _1200x1200.jpg -> .jpg
  pathname = pathname.replace(/_\d+x\./, '.');      // _4000x.jpg -> .jpg
  pathname = pathname.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master)\./, '.');

  console.log('Normalized pathname:', pathname);
} catch (e) {
  console.error('❌ Error:', e.message);
}