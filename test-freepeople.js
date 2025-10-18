const axios = require('axios');

const testUrl = "https://www.freepeople.com/shop/trail-mix-shoe-boots/?color=020&countryCode=US&inventoryCountry=US&type=REGULAR&quantity=1";

async function testFreePeople() {
  console.log('Testing Free People URL through API...');
  console.log('URL:', testUrl);
  console.log('---');

  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: testUrl
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    console.log('Success! Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.status || error.code);
    console.error('Message:', error.response?.data || error.message);

    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFreePeople();