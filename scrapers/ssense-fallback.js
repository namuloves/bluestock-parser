// Fallback scraper for SSENSE when direct access is blocked
function scrapeSsenseFallback(url) {
  console.log('⚠️ Using SSENSE fallback scraper (site is blocking requests)');
  
  // Extract product ID from URL
  const urlParts = url.split('/');
  const productId = urlParts[urlParts.length - 1];
  const productName = urlParts[urlParts.length - 2]?.replace(/-/g, ' ') || 'SSENSE Product';
  const brand = urlParts[urlParts.length - 3]?.replace(/-/g, ' ') || 'SSENSE';
  
  return {
    url,
    name: productName.charAt(0).toUpperCase() + productName.slice(1),
    brand: brand.charAt(0).toUpperCase() + brand.slice(1),
    price: 0,
    originalPrice: null,
    currency: 'USD',
    description: 'SSENSE is blocking automated requests. Please visit the product page directly to view details.',
    images: [],
    sizes: [],
    color: '',
    productId: productId,
    materials: [],
    inStock: true,
    source: 'ssense',
    scrapedAt: new Date().toISOString(),
    blocked: true,
    message: 'SSENSE blocks Railway IPs. The product exists but details cannot be fetched automatically.'
  };
}

module.exports = { scrapeSsenseFallback };