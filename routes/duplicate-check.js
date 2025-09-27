/**
 * Duplicate Check Route
 * Provides endpoint to check for duplicate products
 */

const express = require('express');
const router = express.Router();

// Duplicate check endpoint
router.post('/duplicate-check', async (req, res) => {
  try {
    const { url, productName } = req.body;

    if (!url && !productName) {
      return res.status(400).json({
        error: 'URL or product name is required'
      });
    }

    // For now, return no duplicates found
    // This can be enhanced later with actual database checks
    res.json({
      isDuplicate: false,
      duplicates: [],
      message: 'No duplicates found'
    });

  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      error: 'Failed to check for duplicates',
      details: error.message
    });
  }
});

// Health check for duplicate service
router.get('/duplicate-check/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'duplicate-check'
  });
});

module.exports = router;
