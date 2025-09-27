/**
 * Image Proxy Route
 * Proxies external images through our server to bypass CORS
 * and optionally cache them with Bunny CDN
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Simple in-memory cache for frequently accessed images
const imageCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 3600000; // 1 hour

router.get('/api/image-proxy', async (req, res) => {
  const { url, width, quality, format } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Create cache key
    const cacheKey = `${url}:${width}:${quality}:${format}`;

    // Check cache
    const cached = imageCache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
      res.set(cached.headers);
      return res.send(cached.data);
    }

    // Fetch the image
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bluestock/1.0)',
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8'
      },
      maxRedirects: 5
    });

    // Set appropriate headers
    const headers = {
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Access-Control-Allow-Origin': '*',
      'X-Proxied-From': new URL(url).hostname
    };

    // Cache the image
    if (imageCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }

    imageCache.set(cacheKey, {
      data: response.data,
      headers,
      timestamp: Date.now()
    });

    // Send the image
    res.set(headers);
    res.send(response.data);

  } catch (error) {
    console.error('Image proxy error:', error.message);

    // Try to return a placeholder image on error
    res.status(404).json({
      error: 'Failed to fetch image',
      details: error.message,
      url: url
    });
  }
});

// Health check for proxy
router.get('/api/image-proxy/health', (req, res) => {
  res.json({
    status: 'healthy',
    cacheSize: imageCache.size,
    maxCacheSize: MAX_CACHE_SIZE
  });
});

// Clear proxy cache
router.post('/api/image-proxy/clear-cache', (req, res) => {
  imageCache.clear();
  res.json({ message: 'Image proxy cache cleared' });
});

module.exports = router;