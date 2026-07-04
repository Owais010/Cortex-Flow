const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');

const validate = require('../middleware/validate');
const { executePlan } = require('../core/executor');
const { checkSpendCap } = require('../core/token_counter');
const { getAvailableModels } = require('../db/models');
const supabase = require('../db/supabase');
const analyticsDb = require('../db/analytics');
const { getPlan } = require('../core/plan_store');

const router = express.Router();

const executeSchema = z.object({
  session_id: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
  plan: z.any().optional()
});

function normalizeExecutionResult(planId, plan, result) {
  const subtaskMap = new Map((plan.subtasks || []).map((task) => [task.id, task]));
  const subtaskResults = (result.subtaskResults || []).map((item) => {
    const task = subtaskMap.get(item.subtaskId) || {};
    return {
      id: item.subtaskId,
      title: task.title || `Subtask ${item.subtaskId}`,
      model: item.modelUsed || task.assignedModel || 'unknown',
      output: item.output || '',
      actualTokens: (item.inputTokens || 0) + (item.outputTokens || 0),
      actualCost: item.costUSD || 0,
      latencyMs: item.latencyMs || 0,
      confidenceScore: item.error ? 20 : 80,
      confidenceNote: item.error ? `Execution failed: ${item.error}` : 'Execution completed'
    };
  });

  return {
    planId,
    status: result.status || 'partial',
    subtaskResults,
    finalOutput: result.finalOutput || '',
    analytics: {
      totalTokens: (result.totalInputTokens || 0) + (result.totalOutputTokens || 0),
      totalCost: result.totalCostUSD || 0,
      totalTimeMs: result.totalLatencyMs || 0,
      modelsUsed: [...new Set(subtaskResults.map((r) => r.model))]
    }
  };
}

async function insertExecutionRecord(payload) {
  const base = {
    id: crypto.randomUUID(),
    session_id: payload.sessionId,
    plan_id: payload.planId,
    prompt: payload.prompt,
    category: payload.category,
    difficulty: payload.difficulty,
    status: payload.status,
    models_used: payload.modelsUsed,
    created_at: new Date().toISOString()
  };

  const primaryShape = {
    ...base,
    total_tokens: payload.totalTokens,
    total_cost: payload.totalCost,
    total_time_ms: payload.totalTimeMs,
    fallback_events: payload.fallbackEvents || [],
    confidence_scores: payload.confidenceScores || []
  };

  const fallbackShape = {
    ...base,
    prompt_raw: payload.prompt,
    prompt_category: payload.category,
    total_input_tokens: Math.floor(payload.totalTokens / 2),
    total_output_tokens: Math.ceil(payload.totalTokens / 2),
    total_cost_usd: payload.totalCost,
    latency_ms: payload.totalTimeMs,
    had_fallback: (payload.fallbackEvents || []).length > 0
  };

  let insertError = null;
  ({ error: insertError } = await supabase.from('executions').insert(primaryShape));
  if (!insertError) return;

  ({ error: insertError } = await supabase.from('executions').insert(fallbackShape));
  if (insertError) throw insertError;
}

router.post('/', validate(executeSchema), async (req, res, next) => {
  try {
    const { session_id, plan_id, plan } = req.body;

    let resolvedPlan = plan || null;
    let resolvedPlanId = plan_id || (plan && plan.planId) || crypto.randomUUID();

    if (!resolvedPlan) {
      if (supabase.getLatestPlan) {
        const { data } = await supabase.getLatestPlan(resolvedPlanId);
        if (data && data.session_id === session_id) {
          resolvedPlan = data.plan_json;
        }
      }
      if (!resolvedPlan) {
        const memoryPlan = getPlan(resolvedPlanId);
        if (memoryPlan && memoryPlan.sessionId === session_id) {
          resolvedPlan = memoryPlan;
        }
      }
      if (!resolvedPlan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
    }

    const cap = await checkSpendCap(session_id);
    if (!cap.allowed) {
      return res.status(402).json({
        error: cap.message,
        code: 'SPEND_CAP_EXCEEDED',
        todaySpend: cap.todaySpend
      });
    }

    const { data: keys, error: keysError } = await supabase
      .from('api_key_vault')
      .select('provider, encrypted_key, iv, auth_tag')
      .eq('session_id', session_id)
      .eq('is_valid', true)
      .is('revoked_at', null);

    if (keysError || !keys || keys.length === 0) {
      return res.status(400).json({ error: 'No active API keys found' });
    }

    const keyMap = {};
    for (const key of keys) {
      let combined = key.encrypted_key;
      if (!combined.includes(':') && key.iv && key.auth_tag) {
        combined = `${key.iv}:${key.auth_tag}:${key.encrypted_key}`;
      }
      keyMap[key.provider] = combined;
    }

    const availableModels = await getAvailableModels(session_id);
    if (!availableModels || availableModels.length === 0) {
      return res.status(400).json({ error: 'No models available' });
    }

    const result = await executePlan(resolvedPlan, keyMap, availableModels);
    const response = normalizeExecutionResult(resolvedPlanId, resolvedPlan, result);

    await insertExecutionRecord({
      sessionId: session_id,
      planId: resolvedPlanId,
      prompt: resolvedPlan.prompt || '',
      category: resolvedPlan.category || null,
      difficulty: resolvedPlan.difficulty || null,
      status: response.status,
      modelsUsed: response.analytics.modelsUsed,
      totalTokens: response.analytics.totalTokens,
      totalCost: response.analytics.totalCost,
      totalTimeMs: response.analytics.totalTimeMs,
      fallbackEvents: (result.subtaskResults || []).filter((r) => r.wasFallback).map((r) => ({ subtaskId: r.subtaskId, model: r.modelUsed })),
      confidenceScores: response.subtaskResults.map((r) => ({ id: r.id, score: r.confidenceScore }))
    }).catch((error) => {
      console.warn('[execute] Failed to insert execution record:', error.message);
    });

    analyticsDb.logExecution({
      id: crypto.randomUUID(),
      session_id,
      category: resolvedPlan.category || 'general',
      models_used: response.analytics.modelsUsed,
      total_cost_usd: response.analytics.totalCost
    }, (result.subtaskResults || [])).catch((error) => {
      console.warn('[execute] Analytics logging failed:', error.message);
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
