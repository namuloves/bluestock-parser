const { HttpsProxyAgent } = require('https-proxy-agent');

// Proxy configuration
const getProxyConfig = () => {
  // Force enable proxy if Decodo credentials are present
  const hasDecodoCredentials = process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD;
  
  // Check if proxy is enabled (or if we have Decodo credentials)
  if (process.env.USE_PROXY !== 'true' && !hasDecodoCredentials) {
    return null;
  }

  // Proxy configuration
  let proxyUrl = process.env.PROXY_URL; // Format: http://user:pass@host:port
  
  // Support for Decodo proxy
  if (process.env.DECODO_USERNAME && process.env.DECODO_PASSWORD) {
    // URL encode credentials to handle special characters
    const username = encodeURIComponent(process.env.DECODO_USERNAME);
    const password = encodeURIComponent(process.env.DECODO_PASSWORD);
    proxyUrl = `http://${username}:${password}@gate.decodo.com:10001`;
    console.log('🔐 Using Decodo proxy service');
  } else if (process.env.DECODO_API_KEY) {
    // If only API key is provided, try as password with 'user' as username
    proxyUrl = `http://user:${encodeURIComponent(process.env.DECODO_API_KEY)}@gate.decodo.com:10001`;
    console.log('🔐 Using Decodo proxy service (API key mode)');
  }
  
  if (!proxyUrl) {
    console.warn('USE_PROXY is true but PROXY_URL is not set');
    return null;
  }

  // Sites that need proxy (blocked on cloud servers)
  const proxySites = [
    'ralphlauren.com',
    'cos.com',
    'sezane.com',
    'nordstrom.com',
    'saksfifthavenue.com',
    'saks.com',
    'ssense.com',
    'etsy.com'
  ];

  // Create proxy agent
  const agent = new HttpsProxyAgent(proxyUrl);

  return {
    agent,
    proxySites,
    shouldUseProxy: (url) => {
      return proxySites.some(site => url.includes(site));
    }
  };
};

// Helper to get axios config with proxy if needed
const getAxiosConfig = (url, baseConfig = {}) => {
  const proxyConfig = getProxyConfig();
  
  if (!proxyConfig || !proxyConfig.shouldUseProxy(url)) {
    return baseConfig;
  }

  console.log(`🔐 Using proxy for: ${url}`);
  
  return {
    ...baseConfig,
    httpAgent: proxyConfig.agent,
    httpsAgent: proxyConfig.agent
  };
};

module.exports = {
  getProxyConfig,
  getAxiosConfig
};