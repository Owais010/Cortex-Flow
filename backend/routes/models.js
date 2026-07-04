const express = require('express');
const router = express.Router();
const keysRouter = require('./keys');
const { requireValidSessionId } = require('../core/validation');

router.get('/', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required query parameter: session_id'
      });
    }

    const sessionError = requireValidSessionId(session_id);
    if (sessionError) return res.status(400).json({ error: sessionError });

    const models = await keysRouter.getAvailableModelsForSession(session_id);
    res.json({ models, count: models.length });
  } catch (error) {
    console.error('Error in GET /api/models:', error.message);
    res.status(500).json({
      error: 'Failed to fetch available models',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
