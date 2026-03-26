require('dotenv').config();
const { LinkDiscoverer } = require('./link-discoverer');

async function main() {
  const d = new LinkDiscoverer({
    startUrl: 'https://www.commesi.com',
    maxPages: 10,
    concurrency: 2,
    delayMs: 300,
    stallAfter: 5,
  });
  const { productUrls } = await d.discover();
  console.log('Total product URLs:', productUrls.length);
  console.log('\n/products/ URLs:');
  productUrls.filter(u => u.includes('/products/')).slice(0, 10).forEach(u => console.log(' ', u));
  console.log('\n/collections/ (no /products/) URLs:');
  productUrls.filter(u => u.includes('/collections/') && !u.includes('/products/')).slice(0, 10).forEach(u => console.log(' ', u));
}
main().catch(console.error);
