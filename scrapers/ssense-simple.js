const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function scrapeSsenseSimple(url) {
  try {
    console.log('🔍 Fetching SSENSE page (simple method)...');
    console.log('URL:', url);
    
    // Check if proxy is configured
    let axiosConfig = {};
    if ((process.env.USE_PROXY === 'true' || process.env.DECODO_USERNAME) && process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD) {
      const username = encodeURIComponent(process.env.DECODO_USERNAME);
      const password = encodeURIComponent(process.env.DECODO_PASSWORD);
      const proxyUrl = `http://${username}:${password}@gate.decodo.com:10001`;
      console.log('🔄 Using Decodo proxy for SSENSE');
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }
    
    // Try to fetch with different user agents
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    let response = null;
    let lastError = null;
    
    for (const userAgent of userAgents) {
      try {
        response = await axios.get(url, {
          ...axiosConfig,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          },
          maxRedirects: 5,
          timeout: 30000
        });
        
        if (response.status === 200) {
          console.log('✅ Successfully fetched with user agent:', userAgent.substring(0, 50));
          break;
        }
      } catch (error) {
        lastError = error;
        console.log('❌ Failed with user agent:', userAgent.substring(0, 50));
      }
    }
    
    if (!response || response.status !== 200) {
      throw lastError || new Error('Failed to fetch SSENSE page');
    }
    
    const html = response.data;
    console.log('📄 HTML length:', html.length);
    
    // Extract all image URLs from the HTML
    const extractImages = (html) => {
      const images = [];
      
      // Multiple patterns to find SSENSE images
      const patterns = [
        // Direct image URLs
        /https:\/\/img\.ssensemedia\.com\/images\/[^"'\s,]+\.jpg/gi,
        // In data attributes
        /data-\w+="([^"]*ssensemedia[^"]*\.jpg[^"]*)"/gi,
        // In srcset attributes
        /srcset="([^"]*)"/gi,
        // In JSON strings
        /"https:\\\/\\\/img\.ssensemedia\.com\\\/images\\\/[^"]+\.jpg"/gi,
        // URL encoded
        /https%3A%2F%2Fimg\.ssensemedia\.com%2Fimages%2F[^"'\s]+\.jpg/gi
      ];
      
      for (const pattern of patterns) {
        const matches = [...(html.matchAll(pattern) || [])];
        for (const match of matches) {
          const content = match[1] || match[0];
          
          // Handle srcset (multiple URLs with sizes)
          if (content.includes(',') && content.includes('ssensemedia')) {
            const urls = content.split(',');
            for (const url of urls) {
              const cleanUrl = url.trim().split(' ')[0];
              if (cleanUrl.includes('ssensemedia') && cleanUrl.includes('.jpg')) {
                const finalUrl = cleanUrl
                  .replace(/\\/g, '')
                  .replace(/^["']|["']$/g, '')
                  .split('?')[0];
                if (!images.includes(finalUrl) && !finalUrl.includes('_e1')) {
                  images.push(finalUrl);
                }
              }
            }
          } else if (content.includes('ssensemedia') && content.includes('.jpg')) {
            const finalUrl = content
              .replace(/\\/g, '')
              .replace(/^["']|["']$/g, '')
              .replace(/%2F/g, '/')
              .replace(/%3A/g, ':')
              .split('?')[0];
            if (finalUrl.startsWith('http') && !images.includes(finalUrl) && !finalUrl.includes('_e1')) {
              images.push(finalUrl);
            }
          }
        }
      }
      
      // SSENSE uses predictable URL patterns for multiple images
      // Format: /images/[SKU]_[number]/[product-name].jpg
      if (images.length > 0) {
        const firstImage = images[0];
        // Extract pattern from first image
        const patternMatch = firstImage.match(/\/images\/(\d+[A-Z]\d+)_1\//);
        if (patternMatch) {
          const baseSku = patternMatch[1];
          const baseUrl = firstImage.replace(/_1\//, '_X/');
          
          // SSENSE typically has 1-6 images per product
          for (let i = 2; i <= 6; i++) {
            const additionalUrl = baseUrl.replace('_X/', `_${i}/`);
            if (!images.includes(additionalUrl)) {
              images.push(additionalUrl);
            }
          }
          console.log(`🎯 Generated additional URLs using pattern: ${baseSku}_[1-6]`);
        }
      }
      
      console.log(`📸 Extracted ${images.length} potential images`);
      return images;
    };
    
    const allImages = extractImages(html);
    console.log(`📸 Found ${allImages.length} images in HTML`);
    
    // Extract JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    
    if (!jsonLdMatch) {
      console.log('⚠️ No JSON-LD found, trying meta tags...');
      
      // Fallback to meta tags
      const getMetaContent = (property) => {
        const match = html.match(new RegExp(`property="${property}"[^>]*content="([^"]*)"`, 'i')) ||
                     html.match(new RegExp(`name="${property}"[^>]*content="([^"]*)"`, 'i'));
        return match ? match[1] : null;
      };
      
      const name = getMetaContent('og:title') || 'Unknown Product';
      const image = getMetaContent('og:image');
      const description = getMetaContent('og:description') || '';
      
      // Try to extract price from page
      const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      
      return {
        url,
        name: name.replace(' | SSENSE', ''),
        brand: 'SSENSE',
        price,
        originalPrice: null,
        currency: 'USD',
        description,
        images: allImages.length > 0 ? allImages : (image ? [image] : []),
        sizes: [],
        color: '',
        productId: url.split('/').pop(),
        materials: [],
        inStock: true,
        source: 'ssense',
        scrapedAt: new Date().toISOString()
      };
    }
    
    let productData;
    try {
      productData = JSON.parse(jsonLdMatch[1]);
      console.log('✅ JSON-LD parsed successfully');
    } catch (error) {
      console.error('❌ Failed to parse JSON-LD:', error.message);
      throw new Error('Failed to parse product data');
    }
    
    // Extract color from name
    let color = '';
    if (productData.name) {
      const colorMatch = productData.name.match(/\b(black|white|blue|red|green|yellow|pink|purple|brown|grey|gray|navy|beige|cream|tan)\b/i);
      if (colorMatch) {
        color = colorMatch[0];
      }
    }
    
    return {
      url,
      name: productData.name || 'Unknown Product',
      brand: productData.brand?.name || 'Unknown Brand',
      price: productData.offers?.price || 0,
      originalPrice: null,
      currency: productData.offers?.priceCurrency || 'USD',
      description: productData.description || '',
      images: allImages.length > 0 ? allImages : (productData.image ? [productData.image] : []),
      sizes: [],
      color,
      productId: productData.sku || productData.productID?.toString() || '',
      materials: [],
      inStock: productData.offers?.availability?.includes('InStock') ?? true,
      source: 'ssense',
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error scraping SSENSE (simple):', error.message);
    console.error('Stack:', error.stack);
    
    // Re-throw the error so we can see what's happening
    throw error;
  }
}

module.exports = { scrapeSsenseSimple };