const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const url = 'https://www.thehipstore.co.uk/product/brown-hoka-ora-primo/19719241/';
  console.log('Fetching:', url);

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  console.log('\nTesting price selectors:');
  console.log('.price text:', $('.price').first().text());
  console.log('[itemprop="price"] text:', $('[itemprop="price"]').first().text());
  console.log('.product-price text:', $('.product-price').first().text());
  console.log('.price-now text:', $('.price-now').first().text());
  console.log('.woocommerce-Price-amount text:', $('.woocommerce-Price-amount').first().text());

  console.log('\nLooking for any element with £:');

  // Find elements containing £
  let found = false;
  $('span, div, p').each((i, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    if (text.includes('£') && text.length < 30 && !found) {
      console.log('Found:', text);
      console.log('Element:', el.name);
      console.log('Class:', $(el).attr('class'));
      console.log('Parent class:', $(el).parent().attr('class'));
      found = true;
    }
  });

  // Check meta tags
  console.log('\nMeta tags:');
  console.log('og:price:amount:', $('meta[property="og:price:amount"]').attr('content'));
  console.log('og:price:currency:', $('meta[property="og:price:currency"]').attr('content'));
  console.log('product:price:amount:', $('meta[property="product:price:amount"]').attr('content'));
  console.log('product:price:currency:', $('meta[property="product:price:currency"]').attr('content'));

})().catch(console.error);