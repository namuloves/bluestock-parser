require('dotenv').config();
const { scrapeShopify } = require('../scrapers/shopify');

scrapeShopify('https://www.commesi.com/collections/loungewear/products/silk-bias-pant').then(p => {
  console.log('name:', p.name);
  console.log('images:', p.images?.length);
  p.images?.forEach((u, i) => console.log(` ${i}`, u));
}).catch(e => console.error('Error:', e.message));
