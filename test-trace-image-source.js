const UniversalParserV3 = require('./universal-parser-v3');

// Temporarily patch the parser to trace where images come from
class TracingParser extends UniversalParserV3 {
  constructor() {
    super();
    this.imageSourceMap = new Map();
  }

  addImageCandidate(candidate, images) {
    if (typeof candidate !== 'string') return;

    let normalized = candidate.trim();
    if (!normalized) return;

    if (normalized.startsWith('//')) {
      normalized = `https:${normalized}`;
    }

    // Get stack trace to see where this was called from
    const stack = new Error().stack.split('\n')[2]; // Get caller
    const source = stack.trim();

    // Log what's being validated
    const isValid = this.isValidImageUrl(normalized);
    console.log(`\n${isValid ? '✅' : '❌'} Image candidate: ${normalized}`);
    console.log(`   Source: ${source.substring(0, 100)}`);
    console.log(`   Valid: ${isValid}`);

    if (!this.isValidImageUrl(normalized)) {
      return; // Skip invalid image URLs
    }

    if (!images.has(normalized)) {
      images.add(normalized);
    }
  }
}

async function test() {
  const parser = new TracingParser();
  parser.logLevel = 'verbose';

  const url = 'https://www.bespokepost.com/store/dark-energy-spectre-solar-panel?rl=image';

  console.log('🔍 Tracing image extraction sources...\n');

  const result = await parser.parse(url);

  console.log('\n📦 FINAL RESULT:');
  console.log('Total images:', result?.images?.length);
  result?.images?.forEach((img, i) => {
    const isIcon = img.includes('/icons/');
    const isIncomplete = img.endsWith('c_fill') || img.endsWith('c_limit');
    let flag = isIcon ? '❌ ICON' : isIncomplete ? '❌ INCOMPLETE' : '✅ VALID';
    console.log(`${i + 1}. ${flag} ${img}`);
  });

  await parser.cleanup();
}

test().catch(console.error);
