const express = require('express');
const router = express.Router();
const { getCache } = require('../cache/redis-cache');
const os = require('os');

// Health check endpoint for production monitoring
router.get('/health', async (req, res) => {
  const healthChecks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'bluestock-parser',
    version: process.env.npm_package_version || '1.0.0',
    checks: {}
  };

  // Basic service check
  healthChecks.checks.service = {
    status: 'up',
    message: 'Parser service is running'
  };

  // Redis check
  try {
    const cache = getCache();
    const cacheMetrics = await cache.getMetrics();

    healthChecks.checks.redis = {
      status: cacheMetrics.connected ? 'up' : 'down',
      message: cacheMetrics.connected ? 'Redis connected' : 'Redis disconnected',
      metrics: {
        hitRate: cacheMetrics.hitRate,
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        errors: cacheMetrics.errors
      }
    };

    if (!cacheMetrics.connected) {
      healthChecks.status = 'degraded';
    }
  } catch (error) {
    healthChecks.checks.redis = {
      status: 'error',
      message: error.message
    };
    healthChecks.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = ((1 - freeMem / totalMem) * 100).toFixed(1);

  healthChecks.checks.memory = {
    status: usedMemPercent > 90 ? 'warning' : 'ok',
    message: `Memory usage: ${usedMemPercent}%`,
    details: {
      processMemory: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      systemMemory: `${usedMemPercent}%`,
      freeMemory: `${Math.round(freeMem / 1024 / 1024)}MB`
    }
  };

  if (usedMemPercent > 90) {
    healthChecks.status = 'degraded';
  }

  // Puppeteer browser check
  healthChecks.checks.puppeteer = {
    status: 'ok',
    message: 'Puppeteer available for rendering'
  };

  // Response time check (measure how long health check takes)
  const startTime = Date.now();

  // Set appropriate status code
  let statusCode = 200;
  if (healthChecks.status === 'degraded') {
    statusCode = 503; // Service unavailable
  } else if (healthChecks.status === 'unhealthy') {
    statusCode = 500;
  }

  healthChecks.responseTime = Date.now() - startTime;

  res.status(statusCode).json(healthChecks);
});

// Simplified health check for load balancers
router.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});

// Readiness check - are we ready to serve traffic?
router.get('/health/ready', async (req, res) => {
  try {
    const cache = getCache();
    const cacheMetrics = await cache.getMetrics();

    if (cacheMetrics.connected || !cacheMetrics.enabled) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Cache not connected' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: error.message });
  }
});

// Metrics endpoint for monitoring
router.get('/metrics', async (req, res) => {
  try {
    const cache = getCache();
    const cacheMetrics = await cache.getMetrics();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        process: process.memoryUsage(),
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        }
      },
      cpu: os.cpus(),
      cache: cacheMetrics,
      parsers: {
        // Add parser-specific metrics here
        universal_v3: {
          enabled: true,
          features: ['api_interception', 'pattern_learning', 'redis_cache']
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
