// Simulate the processShopifyImage function
const processShopifyImage = (url) => {
  if (!url) return null;

  console.log('Processing URL:', url);

  // Accept both cdn.shopify.com and Shopify-hosted custom CDNs (e.g., domain.com/cdn/shop/)
  const isShopifyUrl = url.includes('cdn.shopify.com') ||
                      url.includes('/cdn/shop/') ||
                      url.includes('/cdn/shopifycloud/');

  if (!isShopifyUrl) {
    console.log('  Not a Shopify URL');
    return null;
  }

  // Parse URL
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Remove size and crop parameters
    params.delete('width');
    params.delete('height');
    params.delete('crop');

    urlObj.search = params.toString();
    const result = urlObj.toString();
    console.log('  Processed:', result);
    return result;
  } catch (e) {
    console.log('  Error:', e.message);
    return null;
  }
};

// Test with the actual OG image URL
processShopifyImage('http://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_1200x1200.jpg?v=1761232061');
processShopifyImage('https://boutique.airelles.com/cdn/shop/files/porte-cle-dog2_4000x.jpg?v=1761232061');