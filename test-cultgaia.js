const axios = require('axios');

async function testCultGaia() {
  // Test with various Cult Gaia product URLs
  const urls = [
    'https://cultgaia.com/products/gia-dress-ivory',
    'https://cultgaia.com/products/kamira-dress-black',
    'https://cultgaia.com/products/serita-knit-dress-pearl'
  ];
  
  console.log('Testing Cult Gaia size chart extraction...\n');
  
  for (const url of urls) {
    console.log('='.repeat(70));
    console.log('Testing:', url);
    console.log('='.repeat(70));
    
    try {
      const response = await axios.post('http://localhost:3001/parse-size-chart', {
        url: url,
        timeout: 60000
      });
      
      if (response.data.success && response.data.sizeChart) {
        const chart = response.data.sizeChart;
        console.log('\n✅ SIZE CHART FOUND!');
        console.log('Type:', chart.type);
        
        if (chart.type === 'table') {
          console.log('\nTable Data:');
          console.log('Headers:', chart.headers);
          console.log('Number of rows:', chart.rows?.length);
          
          if (chart.rows && chart.rows.length > 0) {
            console.log('\nFull Size Chart:');
            console.log('Headers:', chart.headers.join(' | '));
            console.log('-'.repeat(50));
            chart.rows.forEach(row => {
              console.log(row.join(' | '));
            });
          }
          
          if (chart.unit) {
            console.log('\nUnit:', chart.unit);
          }
        } else if (chart.type === 'image') {
          console.log('Image URL:', chart.imageUrl?.substring(0, 100) + '...');
          console.log('Alt text:', chart.alt_text);
        } else if (chart.type === 'measurements') {
          console.log('Measurements:', JSON.stringify(chart.data, null, 2));
          console.log('Unit:', chart.unit);
        }
      } else {
        console.log('\n❌ Size chart not extracted');
        console.log('Error:', response.data.error);
        if (response.data.sizeChart?.requiresInteraction) {
          console.log('Note: Size chart requires interaction that could not be automated');
        }
      }
      
    } catch (error) {
      console.error('❌ Request failed:', error.message);
    }
    
    console.log('');
    
    // Wait a bit between requests to be polite
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('='.repeat(70));
  console.log('Cult Gaia test completed');
  console.log('='.repeat(70));
}

testCultGaia().catch(console.error);