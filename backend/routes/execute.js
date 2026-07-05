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
  plan: z.any().optional(),
  conversation_history: z.array(z.object({
    prompt: z.string(),
    resultSummary: z.string().optional(),
    response: z.string().optional()
  })).optional(),
  shared_context: z.object({
    facts: z.array(z.string()).optional(),
    decisions: z.array(z.string()).optional()
  }).optional()
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

/**
 * Resolve the plan, spend cap, decrypted key map, and available models for a
 * request. Returns { ok: true, ... } on success, or { ok: false, status, body }
 * with a ready-to-send error. Shared by the batch and streaming endpoints.
 */
async function prepareExecution(req) {
  const { session_id, plan_id, plan } = req.body;

  let resolvedPlan = plan || null;
  const resolvedPlanId = plan_id || (plan && plan.planId) || crypto.randomUUID();

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
      return { ok: false, status: 404, body: { error: 'Plan not found' } };
    }
  }

  const cap = await checkSpendCap(session_id);
  if (!cap.allowed) {
    return {
      ok: false,
      status: 402,
      body: { error: cap.message, code: 'SPEND_CAP_EXCEEDED', todaySpend: cap.todaySpend }
    };
  }

  const { data: keys, error: keysError } = await supabase
    .from('api_key_vault')
    .select('provider, encrypted_key, iv, auth_tag')
    .eq('session_id', session_id)
    .eq('is_valid', true)
    .is('revoked_at', null);

  if (keysError || !keys || keys.length === 0) {
    return { ok: false, status: 400, body: { error: 'No active API keys found' } };
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
    return { ok: false, status: 400, body: { error: 'No models available' } };
  }

  return { ok: true, resolvedPlan, resolvedPlanId, keyMap, availableModels };
}

/** Persist the execution record + analytics (fire-and-forget, never throws). */
function persistExecution(session_id, resolvedPlanId, resolvedPlan, result, response) {
  insertExecutionRecord({
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
}

router.post('/', validate(executeSchema), async (req, res, next) => {
  try {
    const { session_id, conversation_history, shared_context } = req.body;

    const prep = await prepareExecution(req);
    if (!prep.ok) return res.status(prep.status).json(prep.body);
    const { resolvedPlan, resolvedPlanId, keyMap, availableModels } = prep;

    const result = await executePlan(resolvedPlan, keyMap, availableModels, session_id, {
      conversationHistory: conversation_history || [],
      sharedContext: {
        facts: shared_context?.facts || [],
        decisions: shared_context?.decisions || []
      }
    });
    const response = normalizeExecutionResult(resolvedPlanId, resolvedPlan, result);
    persistExecution(session_id, resolvedPlanId, resolvedPlan, result, response);

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

/**
 * Streaming variant: emits Server-Sent Events as each subtask starts and
 * settles, then a final `done` frame carrying the same normalized response the
 * batch endpoint returns. Consumed by the frontend via fetch + ReadableStream.
 */
router.post('/stream', validate(executeSchema), async (req, res) => {
  const { session_id, conversation_history, shared_context } = req.body;

  // SSE headers — flush immediately and disable proxy buffering.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat keeps intermediaries from closing an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  try {
    const prep = await prepareExecution(req);
    if (!prep.ok) {
      send('error', prep.body);
      clearInterval(heartbeat);
      return res.end();
    }
    const { resolvedPlan, resolvedPlanId, keyMap, availableModels } = prep;

    send('start', {
      planId: resolvedPlanId,
      subtaskIds: (resolvedPlan.subtasks || []).map((s) => s.id)
    });

    const result = await executePlan(
      resolvedPlan,
      keyMap,
      availableModels,
      session_id,
      {
        conversationHistory: conversation_history || [],
        sharedContext: {
          facts: shared_context?.facts || [],
          decisions: shared_context?.decisions || []
        }
      },
      (evt) => send(evt.type, evt)
    );

    const response = normalizeExecutionResult(resolvedPlanId, resolvedPlan, result);
    persistExecution(session_id, resolvedPlanId, resolvedPlan, result, response);

    send('done', response);
  } catch (error) {
    send('error', { error: error.message || 'Execution failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

module.exports = router;
