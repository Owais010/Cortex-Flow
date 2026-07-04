const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { getAvailableModels } = require('../db/models');
const { getSessionSummary, seedDemoData, getCheapestModelPerCategory } = require('../db/analytics');

const router = express.Router();

const analyticsSchema = z.object({
  session_id: z.string().uuid()
});

router.get('/', validate(analyticsSchema, 'query'), async (req, res, next) => {
  try {
    const { session_id } = req.query;

    const availableModels = await getAvailableModels(session_id);

    let summary = await getSessionSummary(session_id);

    if (summary.totalRuns === 0) {
      await seedDemoData(session_id);
      summary = await getSessionSummary(session_id);
    }

    const cheapest = await getCheapestModelPerCategory(session_id, availableModels);

    res.json({
      success: true,
      summary,
      cheapestByCategory: cheapest,
      availableModels: availableModels.map(m => ({
        id: m.id,
        provider: m.provider,
        displayName: m.displayName,
        inputCostPer1k: m.inputCostPer1k ?? m.cost_per_1k_input ?? 0,
        outputCostPer1k: m.outputCostPer1k ?? m.cost_per_1k_output ?? 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
