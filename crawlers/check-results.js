require('dotenv').config();
const fs = require('fs'), path = require('path');
const dir = path.join(process.env.CRAWL_OUTPUT_DIR, 'commesi.com/products');
if (!fs.existsSync(dir)) { console.log('products dir not yet created'); process.exit(); }
const files = fs.readdirSync(dir);
console.log('Products on disk:', files.length);
const sample = JSON.parse(fs.readFileSync(path.join(dir, files[0])));
console.log('name:', sample.product_name);
console.log('brand:', sample.brand);
console.log('price:', sample.original_price, sample.currency);
console.log('images:', sample.image_urls?.length);
console.log('first image:', sample.image_urls?.[0]?.slice(0, 80));
console.log('availability:', sample.availability);
console.log('vendor_url:', sample.vendor_url);
