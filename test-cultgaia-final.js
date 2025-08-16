const axios = require('axios');

async function testCultGaiaFinal() {
  const url = 'https://cultgaia.com/products/akaia-dress-off-white';
  
  console.log('Testing Cult Gaia with valid product URL');
  console.log('URL:', url);
  console.log('-'.repeat(70));
  
  try {
    console.log('\nSending request to parser...');
    const response = await axios.post('http://localhost:3001/parse-size-chart', {
      url: url,
      timeout: 60000
    });
    
    console.log('\nResponse received:');
    console.log('Success:', response.data.success);
    console.log('Has sizeChart field:', 'sizeChart' in response.data);
    
    if (response.data.success && response.data.sizeChart) {
      const chart = response.data.sizeChart;
      console.log('\n✅ SIZE CHART EXTRACTED!');
      console.log('Type:', chart.type);
      
      if (chart.type === 'table') {
        console.log('\nTable Data:');
        console.log('Headers:', chart.headers);
        console.log('Number of rows:', chart.rows?.length);
        
        if (chart.rows && chart.rows.length > 0) {
          console.log('\nFull Size Chart:');
          console.log(chart.headers.join(' | '));
          console.log('-'.repeat(50));
          chart.rows.forEach(row => {
            console.log(row.join(' | '));
          });
        }
      } else if (chart.type === 'image') {
        console.log('Image URL:', chart.imageUrl?.substring(0, 100) + '...');
        console.log('Alt text:', chart.alt_text);
      } else if (chart.type === 'measurements') {
        console.log('Measurements:', JSON.stringify(chart.data, null, 2));
      }
    } else {
      console.log('\n❌ Cult Gaia size chart NOT extracted');
      console.log('Error:', response.data.error);
      if (response.data.sizeChart?.requiresInteraction) {
        console.log('Note: Size chart requires interaction that could not be automated');
      }
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY: Cult Gaia size chart extraction status');
  console.log('='.repeat(70));
}

testCultGaiaFinal();