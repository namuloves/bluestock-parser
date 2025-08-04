const fs = require('fs');

// Read the saved HTML
const html = fs.readFileSync('saks-axios-response.html', 'utf8');

// Extract window.__remixContext
const remixMatch = html.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/);

if (remixMatch) {
  try {
    const remixData = JSON.parse(remixMatch[1]);
    const productRoute = remixData?.state?.loaderData?.['routes/product.$'];
    const productData = productRoute?.productData;
    
    // Save full product data for inspection
    fs.writeFileSync('saks-product-data.json', JSON.stringify(productData, null, 2));
    console.log('✅ Full product data saved to saks-product-data.json');
    
    // Look for description in various places
    console.log('\n🔍 Searching for description fields...\n');
    
    // Check for accordions or details sections
    if (productData?.accordions) {
      console.log('Found accordions:', JSON.stringify(productData.accordions, null, 2).substring(0, 500));
    }
    
    if (productData?.details) {
      console.log('Found details:', JSON.stringify(productData.details, null, 2).substring(0, 500));
    }
    
    if (productData?.productDetails) {
      console.log('Found productDetails:', JSON.stringify(productData.productDetails, null, 2).substring(0, 500));
    }
    
    if (productData?.description) {
      console.log('Found description:', JSON.stringify(productData.description, null, 2).substring(0, 500));
    }
    
    // Check body structure
    if (productData?.body) {
      console.log('\n🔍 Checking body structure...');
      const bodyKeys = Object.keys(productData.body);
      console.log('Body keys:', bodyKeys);
      
      // Look for nodes that might contain description
      if (productData.body.nodes) {
        console.log('\nBody has nodes, checking for description content...');
        
        // Function to recursively search nodes
        function searchNodes(nodes, depth = 0) {
          if (!nodes || depth > 10) return;
          
          nodes.forEach((node, index) => {
            if (node.node?.__typename === 'AccordionView') {
              console.log(`\nFound AccordionView at index ${index}:`);
              if (node.node.items) {
                node.node.items.forEach(item => {
                  if (item.title) {
                    console.log('  Title:', JSON.stringify(item.title, null, 2).substring(0, 200));
                  }
                  if (item.content) {
                    console.log('  Content:', JSON.stringify(item.content, null, 2).substring(0, 500));
                  }
                });
              }
            }
            
            // Check for text content
            if (node.node?.__typename === 'RichText' || node.node?.__typename === 'TextView') {
              console.log(`\nFound ${node.node.__typename} at index ${index}:`);
              console.log(JSON.stringify(node.node, null, 2).substring(0, 500));
            }
            
            // Recurse if there are child nodes
            if (node.nodes) {
              searchNodes(node.nodes, depth + 1);
            }
          });
        }
        
        searchNodes(productData.body.nodes);
      }
    }
    
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
  }
} else {
  console.log('No remix context found');
}