const { HttpsProxyAgent } = require('https-proxy-agent');

// Proxy configuration
const getProxyConfig = () => {
  // Check if proxy is enabled
  if (process.env.USE_PROXY !== 'true') {
    return null;
  }

  // Proxy URL from environment
  const proxyUrl = process.env.PROXY_URL; // Format: http://user:pass@host:port
  
  if (!proxyUrl) {
    console.warn('USE_PROXY is true but PROXY_URL is not set');
    return null;
  }

  // Sites that need proxy (blocked on cloud servers)
  const proxySites = [
    'ralphlauren.com',
    'cos.com',
    'sezane.com'
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