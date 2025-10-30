const axios = require('axios');

async function testZaraImagePatterns() {
  const productId = '15205610';
  const variantCodes = ['402', '800'];

  // Different year/season combinations
  const patterns = [
    // 2025 patterns (current year)
    'https://static.zara.net/photos//2025/V/0/1/p/1520/5610/402/2/1920x2880/15205610402_6_1_1.jpg',
    'https://static.zara.net/photos//2025/I/0/1/p/1520/5610/402/2/1920x2880/15205610402_6_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/1520/5610/402/2/w/1920/15205610402_6_1_1.jpg',

    // Without dimensions in path
    'https://static.zara.net/photos//2024/I/0/1/p/1520/5610/402/2/w/1920/15205610402_6_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/1520/5610/402/2/w/850/15205610402_6_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/1520/5610/402/2/w/563/15205610402_6_1_1.jpg',

    // Simpler patterns
    'https://static.zara.net/photos//2024/I/0/1/p/1520/561/040/2/w/1920/15205610402_1_1_1.jpg',
    'https://static.zara.net/photos//2024/I/1/1/p/5205/610/402/2/w/1920/15205610402_1_1_1.jpg',

    // Without product path structure
    'https://static.zara.net/photos//2024/I/0/1/p/15205610/402/w/1920/15205610402_1_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/15205610/w/1920/15205610_1_1_1.jpg',

    // Assets path (different CDN structure)
    'https://static.zara.net/assets/public/2024/I/15205610402_1_1_1.jpg',
    'https://static.zara.net/assets/public/8b0e/7c4e/15205610402.jpg',

    // Media transforms path
    'https://static.zara.net/photos//media-manager/15205610402_1_1_1.jpg',

    // Current working examples from other products
    'https://static.zara.net/photos//2024/I/0/1/p/2298/430/615/2/w/850/22984306_15_1_1.jpg',
    'https://static.zara.net/photos//2024/I/0/1/p/5520/461/040/2/w/563/15205610402_1_1_1.jpg',
  ];

  console.log('Testing Zara image URL patterns for product:', productId);
  console.log('Total patterns to test:', patterns.length);
  console.log('---\n');

  const workingUrls = [];

  for (const url of patterns) {
    try {
      const response = await axios.head(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.zara.com/',
        },
        timeout: 5000,
        validateStatus: () => true
      });

      if (response.status === 200) {
        console.log(`✅ WORKING: ${url}`);
        workingUrls.push(url);
      } else {
        console.log(`❌ ${response.status}: ${url.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${url.substring(0, 100)}... - ${error.message}`);
    }
  }

  if (workingUrls.length > 0) {
    console.log('\n✅ Found working URL patterns:');
    workingUrls.forEach(url => console.log('  -', url));
  } else {
    console.log('\n❌ No working URLs found. The product might:');
    console.log('  - Be out of stock or discontinued');
    console.log('  - Have different URL structure');
    console.log('  - Require authentication/cookies to access images');
  }
}

testZaraImagePatterns();