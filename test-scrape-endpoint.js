(async () => {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/';
  console.log('Testing /scrape endpoint...\n');

  const response = await fetch('http://localhost:3001/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Success:', data.success);

  if (data.product) {
    console.log('Name:', data.product.product_name);
    console.log('Brand:', data.product.brand);
    console.log('Price:', data.product.sale_price);
    console.log('Images:', data.product.image_urls?.length || 0);
    if (data.product.image_urls?.length > 0) {
      console.log('\nFirst 3 images:');
      data.product.image_urls.slice(0, 3).forEach((img, i) => console.log(`  ${i+1}. ${img}`));
    }
  } else {
    console.log('Error:', data.error);
  }
})();
