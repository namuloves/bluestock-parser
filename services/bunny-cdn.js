/**
 * Bunny CDN Service
 * Transforms scraped image URLs to route through Bunny CDN for optimization and CORS bypass
 */

class BunnyCDNService {
  constructor() {
    // Bunny CDN configuration from environment or defaults
    this.pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL || 'bluestock.b-cdn.net';
    this.optimizerEnabled = process.env.BUNNY_OPTIMIZER !== 'false';
    this.enabled = process.env.ENABLE_BUNNY_CDN !== 'false';

    // Image proxy endpoint (we'll create this)
    this.proxyEndpoint = process.env.IMAGE_PROXY_URL || 'https://bluestock-parser-production.up.railway.app/api/image-proxy';

    console.log('🐰 Bunny CDN Service initialized:', {
      enabled: this.enabled,
      pullZone: this.pullZoneUrl,
      optimizer: this.optimizerEnabled
    });
  }

  /**
   * Transform a single image URL to use Bunny CDN
   * @param {string} imageUrl - Original image URL
   * @param {object} options - Transformation options
   * @returns {string} - Transformed CDN URL
   */
  transformImageUrl(imageUrl, options = {}) {
    if (!this.enabled || !imageUrl) {
      return imageUrl;
    }

    try {
      // Skip if already a CDN URL
      if (imageUrl.includes(this.pullZoneUrl) || imageUrl.includes('b-cdn.net')) {
        return imageUrl;
      }

      // Handle different URL types
      const url = new URL(imageUrl);

      // For Supabase URLs, use direct CDN transformation
      if (imageUrl.includes('supabase.co')) {
        const path = imageUrl.split('supabase.co')[1];
        const params = new URLSearchParams({
          width: options.width || '800',
          quality: options.quality || '85',
          auto_webp: 'true'
        });
        return `https://${this.pullZoneUrl}${path}?${params}`;
      }

      // For external URLs (eBay, wconcept, etc.), return original URL
      // These sites have their own optimized CDNs and don't need proxying
      const externalDomains = ['ebay.com', 'ebayimg.com', 'wconcept.com', 'shopify.com', 'zara.com'];
      const isExternalUrl = externalDomains.some(domain => imageUrl.includes(domain));

      if (isExternalUrl) {
        console.log('🔗 Keeping external URL unchanged:', imageUrl.substring(0, 50) + '...');
        return imageUrl;
      }

      // For other unknown external URLs, also return unchanged
      // BunnyCDN can't proxy arbitrary external URLs without proper configuration
      console.log('🔗 Keeping unknown external URL unchanged:', imageUrl.substring(0, 50) + '...');
      return imageUrl;

    } catch (error) {
      console.error('❌ Error transforming image URL:', error.message);
      return imageUrl; // Return original on error
    }
  }

  /**
   * Transform all image URLs in an array
   * @param {string[]} imageUrls - Array of image URLs
   * @param {object} options - Transformation options
   * @returns {string[]} - Array of transformed URLs
   */
  transformImageUrls(imageUrls, options = {}) {
    if (!Array.isArray(imageUrls)) {
      return [];
    }

    return imageUrls.map(url => this.transformImageUrl(url, options));
  }

  /**
   * Transform product data to use CDN URLs
   * @param {object} productData - Product data with image URLs
   * @returns {object} - Product data with transformed URLs
   */
  transformProductImages(productData) {
    if (!productData || !this.enabled) {
      return productData;
    }

    // Transform both possible image field names
    if (productData.image_urls) {
      productData.image_urls = this.transformImageUrls(productData.image_urls);
    }

    if (productData.images) {
      productData.images = this.transformImageUrls(productData.images);
    }

    // Transform single image field if exists
    if (productData.image) {
      productData.image = this.transformImageUrl(productData.image);
    }

    // Transform thumbnail if exists
    if (productData.thumbnail) {
      productData.thumbnail = this.transformImageUrl(productData.thumbnail, { width: 400 });
    }

    return productData;
  }

  /**
   * Get optimized thumbnail URL
   * @param {string} imageUrl - Original image URL
   * @returns {string} - Optimized thumbnail URL
   */
  getThumbnailUrl(imageUrl) {
    return this.transformImageUrl(imageUrl, {
      width: 400,
      quality: 80,
      format: 'webp'
    });
  }

  /**
   * Get high quality image URL
   * @param {string} imageUrl - Original image URL
   * @returns {string} - High quality image URL
   */
  getHighQualityUrl(imageUrl) {
    return this.transformImageUrl(imageUrl, {
      width: 1920,
      quality: 90,
      format: 'auto'
    });
  }

  /**
   * Validate if URL is accessible through CDN
   * @param {string} imageUrl - Image URL to validate
   * @returns {Promise<boolean>} - True if accessible
   */
  async validateUrl(imageUrl) {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let cdnInstance = null;

function getCDNService() {
  if (!cdnInstance) {
    cdnInstance = new BunnyCDNService();
  }
  return cdnInstance;
}

module.exports = { BunnyCDNService, getCDNService };