const UniversalParserV3 = require('./universal-parser-v3');
const parser = new UniversalParserV3();

(async () => {
  const result = await parser.parse('https://69mcfly.com/shop/all-clothing/nyc-tee/');
  console.log('Brand from parser:', result.brand);
  console.log('Full result:', JSON.stringify(result, null, 2));
})();
