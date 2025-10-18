const { scrapeZara } = require('./scrapers/zara');

async function testZaraImages() {
  const url = 'https://www.zara.com/us/en/zw-collection-gingham-bloomer-pants-p09479258.html?v1=487007982&v2=2491343';

  console.log('Testing URL:', url);
  console.log('Expected: Model photos first (usually _6_, _2_, _3_ suffixes), then product photos');
  console.log('---\n');

  const result = await scrapeZara(url);

  console.log('Product Name:', result.name);
  console.log('Total Images Found:', result.images?.length || 0);
  console.log('\nImage URLs (in order):');

  if (result.images) {
    result.images.forEach((img, idx) => {
      // Extract the image number from URL (e.g., _6_1_1 means image #6)
      const match = img.match(/_(\d+)_\d+_\d+\./);
      const imageNum = match ? match[1] : 'unknown';

      // Check if it's the correct product variant
      const hasCorrectVariant = img.includes('09479258402') || img.includes('09479258684');
      const variant = img.includes('684') ? '684 (different color)' : img.includes('402') ? '402 (correct)' : 'other';

      console.log(`${idx + 1}. Image #${imageNum} - Variant: ${variant}`);
      console.log(`   ${img}`);
      console.log();
    });
  }

  // Extract just the v1 parameter to understand the variant
  const v1Match = url.match(/v1=(\d+)/);
  const v1 = v1Match ? v1Match[1] : 'unknown';
  console.log(`\nNote: URL parameter v1=${v1} seems to indicate specific variant`);
  console.log('The correct variant should probably be based on this v1 parameter');
}

testZaraImages().catch(console.error);