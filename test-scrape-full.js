(async () => {
  const url = 'https://69mcfly.com/shop/all-clothing/nyc-tee/';
  console.log('Testing /scrape endpoint...\n');

  const response = await fetch('http://localhost:3001/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const data = await response.json();
  console.log('Full response:');
  console.log(JSON.stringify(data, null, 2));
})();
