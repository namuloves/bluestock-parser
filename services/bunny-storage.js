const axios = require('axios');
const crypto = require('crypto');

class BunnyStorageService {
  constructor() {
    this.apiKey = process.env.BUNNY_STORAGE_API_KEY;
    this.storageZone = process.env.BUNNY_STORAGE_ZONE || 'bluestock-assets';
    this.pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL || 'bluestock.b-cdn.net';
    this.storageEndpoint = `https://storage.bunnycdn.com/${this.storageZone}`;

    if (!this.apiKey) {
      console.warn('⚠️ BUNNY_STORAGE_API_KEY not configured - storage uploads disabled');
    }
  }

  /**
   * Generate a unique fingerprint for an image URL
   */
  generateFingerprint(originalUrl) {
    return crypto.createHash('sha256').update(originalUrl).digest('hex').substring(0, 16);
  }

  /**
   * Get file extension from URL or content type
   */
  getFileExtension(url, contentType = '') {
    // Try to get extension from URL
    const urlExt = url.split('.').pop().split('?')[0].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt)) {
      return urlExt === 'jpeg' ? 'jpg' : urlExt;
    }

    // Fallback to content type
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';

    return 'jpg'; // Default fallback
  }

  /**
   * Upload image to Bunny Storage
   */
  async uploadImage(imageUrl, fingerprint = null) {
    if (!this.apiKey) {
      throw new Error('Bunny Storage API key not configured');
    }

    try {
      // Download the image
      console.log(`📥 Downloading image: ${imageUrl}`);

      // Extract domain from image URL for referer
      const imageUrlObj = new URL(imageUrl);
      const referer = `${imageUrlObj.protocol}//${imageUrlObj.hostname}/`;

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': referer,  // Critical for sites like Aritzia that check referer
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      // Generate fingerprint if not provided
      const imageFP = fingerprint || this.generateFingerprint(imageUrl);
      const extension = this.getFileExtension(imageUrl, imageResponse.headers['content-type']);
      const fileName = `originals/${imageFP}.${extension}`;

      // Upload to Bunny Storage
      console.log(`📤 Uploading to Bunny Storage: ${fileName}`);
      const uploadResponse = await axios.put(
        `${this.storageEndpoint}/${fileName}`,
        imageResponse.data,
        {
          headers: {
            'AccessKey': this.apiKey,
            'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg'
          },
          timeout: 60000
        }
      );

      if (uploadResponse.status === 201 || uploadResponse.status === 200) {
        console.log(`✅ Successfully uploaded: ${fileName}`);
        return {
          success: true,
          fileName,
          fingerprint: imageFP,
          extension,
          originalUrl: imageUrl,
          cdnUrl: this.buildCDNUrl(fileName)
        };
      } else {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

    } catch (error) {
      console.error(`❌ Failed to upload image ${imageUrl}:`, error.message);
      return {
        success: false,
        error: error.message,
        originalUrl: imageUrl
      };
    }
  }

  /**
   * Build optimized CDN URL
   */
  buildCDNUrl(fileName, options = {}) {
    const {
      width = 720,
      height = null,
      quality = 85,
      format = 'auto',
      fit = 'cover'
    } = options;

    // Build query params for Bunny Optimizer
    const params = new URLSearchParams();
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    if (quality !== 85) params.append('quality', quality);
    if (fit !== 'cover') params.append('aspect_ratio', fit);

    const queryString = params.toString();
    const baseUrl = `https://${this.pullZoneUrl}/${fileName}`;

    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Upload multiple images and return CDN URLs
   */
  async uploadImages(imageUrls, optimizeOptions = {}) {
    const results = [];

    for (const imageUrl of imageUrls) {
      const result = await this.uploadImage(imageUrl);
      if (result.success) {
        results.push({
          original: imageUrl,
          cdn: this.buildCDNUrl(result.fileName, optimizeOptions),
          fingerprint: result.fingerprint
        });
      } else {
        // If upload fails, return original URL as fallback
        console.warn(`⚠️ Using original URL as fallback: ${imageUrl}`);
        results.push({
          original: imageUrl,
          cdn: imageUrl,
          fingerprint: null,
          error: result.error
        });
      }
    }

    return results;
  }

  /**
   * Check if image already exists in storage
   */
  async imageExists(fingerprint, extension) {
    if (!this.apiKey) return false;

    try {
      const fileName = `originals/${fingerprint}.${extension}`;
      const response = await axios.head(`${this.storageEndpoint}/${fileName}`, {
        headers: {
          'AccessKey': this.apiKey
        },
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get CDN URL for existing image
   */
  getCDNUrl(fingerprint, extension, options = {}) {
    const fileName = `originals/${fingerprint}.${extension}`;
    return this.buildCDNUrl(fileName, options);
  }
}

module.exports = BunnyStorageService;