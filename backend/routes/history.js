const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const supabase = require('../db/supabase');

const router = express.Router();

const historySchema = z.object({
  session_id: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

router.get('/', validate(historySchema, 'query'), async (req, res, next) => {
  try {
    const { session_id, limit, offset } = req.query;

    const { data: rows, error, count } = await supabase
      .from('executions')
      .select('*', { count: 'exact' })
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }

    const history = rows.map(r => ({
      id: r.id,
      category: r.prompt_category || r.category,
      difficulty: r.difficulty,
      models_used: r.models_used,
      total_cost_usd: Number(r.total_cost_usd ?? r.total_cost ?? 0),
      total_cost_inr: Number(((Number(r.total_cost_usd ?? r.total_cost ?? 0)) * 83.5).toFixed(4)),
      latency_ms: Number(r.latency_ms ?? r.total_time_ms ?? 0),
      status: r.status,
      had_fallback: Boolean(r.had_fallback || (Array.isArray(r.fallback_events) && r.fallback_events.length > 0)),
      created_at: r.created_at
    }));

    res.json({
      success: true,
      history,
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: offset + limit < (count || 0)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
