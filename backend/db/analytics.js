const supabase = require('./supabase');
const { getProviderForModel } = require('./models');

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function upsertModelUsageStats(sessionId, modelId, callCount, tokensIn, tokensOut, costUsd, latencyMs = 0, fallbackCount = 0) {
  const today = new Date().toISOString().split('T')[0];
  const upsertData = {
    session_id: sessionId,
    model_id: modelId,
    period_date: today,
    call_count: callCount,
    total_tokens_in: tokensIn,
    total_tokens_out: tokensOut,
    total_cost_usd: safeNumber(costUsd).toFixed(6),
    avg_latency_ms: latencyMs,
    fallback_count: fallbackCount
  };

  const { error } = await supabase.from('model_usage_stats').upsert(upsertData, {
    onConflict: 'session_id,model_id,period_date'
  });
  if (error) throw error;
}

async function checkDailySpendCap(sessionId, cap) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('executions')
    .select('*')
    .eq('session_id', sessionId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lt('created_at', `${today}T23:59:59.999Z`);

  if (error) throw error;
  const total = (data || []).reduce((sum, row) => {
    const cost = row.total_cost_usd ?? row.total_cost ?? 0;
    return sum + safeNumber(cost);
  }, 0);

  return total <= cap;
}

async function logExecution(executionRow, subtaskResults) {
  const models = [...new Set((subtaskResults || []).map((r) => r.modelUsed).filter(Boolean))];
  const modelRows = models.length > 0
    ? await supabase.from('model_registry').select('id, model_id').in('model_id', models)
    : { data: [], error: null };

  if (modelRows.error) {
    console.warn('[analytics] model_registry lookup failed:', modelRows.error.message);
  }

  const modelUuidMap = {};
  (modelRows.data || []).forEach((m) => { modelUuidMap[m.model_id] = m.id; });

  for (const r of subtaskResults || []) {
    if (!r.modelUsed || !modelUuidMap[r.modelUsed]) continue;
    try {
      await upsertModelUsageStats(
        executionRow.session_id,
        modelUuidMap[r.modelUsed],
        1,
        safeNumber(r.inputTokens),
        safeNumber(r.outputTokens),
        safeNumber(r.costUSD),
        safeNumber(r.latencyMs),
        r.wasFallback ? 1 : 0
      );
    } catch (error) {
      console.warn('[analytics] upsert model usage failed:', error.message);
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: null,
    action: 'execution_completed',
    resource_type: 'execution',
    resource_id: executionRow.id,
    metadata: {
      session_id: executionRow.session_id,
      category: executionRow.category,
      models_used: executionRow.models_used,
      total_cost: executionRow.total_cost_usd
    },
    created_at: new Date().toISOString()
  }).then(({ error }) => {
    if (error) console.warn('[analytics] audit log write failed:', error.message);
  });
}

async function getSessionSummary(sessionId) {
  const today = new Date().toISOString().split('T')[0];
  const summary = {
    totalRuns: 0,
    totalCostUSD: 0,
    totalCostINR: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    successRate: 0,
    todaySpend: 0,
    spendByProvider: {},
    cheapestByCategory: {},
    fallbackRate: 0
  };

  const { data: executions, error: execError } = await supabase
    .from('executions')
    .select('*')
    .eq('session_id', sessionId);

  if (execError || !executions) {
    return summary;
  }

  summary.totalRuns = executions.length;
  if (executions.length === 0) return summary;

  let totalCost = 0;
  let totalTokens = 0;
  let totalLatency = 0;
  let successCount = 0;
  let todaySpend = 0;
  let fallbackCount = 0;

  for (const execution of executions) {
    const cost = safeNumber(execution.total_cost_usd ?? execution.total_cost);
    const total = safeNumber(execution.total_tokens ?? (safeNumber(execution.total_input_tokens) + safeNumber(execution.total_output_tokens)));
    const latency = safeNumber(execution.total_time_ms ?? execution.latency_ms);
    const models = execution.models_used || [];

    totalCost += cost;
    totalTokens += total;
    totalLatency += latency;
    if (execution.status === 'completed') successCount += 1;
    if (execution.had_fallback) fallbackCount += 1;

    const rowDate = execution.created_at ? String(execution.created_at).split('T')[0] : null;
    if (rowDate === today) todaySpend += cost;

    for (const model of models) {
      const provider = getProviderForModel(model) || 'unknown';
      summary.spendByProvider[provider] = safeNumber(summary.spendByProvider[provider]) + cost / Math.max(models.length, 1);
    }
  }

  summary.totalCostUSD = Number(totalCost.toFixed(6));
  summary.totalCostINR = Number((totalCost * 83.5).toFixed(4));
  summary.totalTokens = totalTokens;
  summary.avgLatencyMs = Math.round(totalLatency / executions.length);
  summary.successRate = Number((successCount / executions.length).toFixed(6));
  summary.todaySpend = Number(todaySpend.toFixed(6));
  summary.fallbackRate = Number((fallbackCount / executions.length).toFixed(6));

  Object.keys(summary.spendByProvider).forEach((k) => {
    summary.spendByProvider[k] = Number(summary.spendByProvider[k].toFixed(6));
  });

  return summary;
}

async function getCheapestModelPerCategory(sessionId, availableModels) {
  const cheapest = {};
  const availableIds = new Set((availableModels || []).map((m) => m.id));

  const { data: executions, error } = await supabase
    .from('executions')
    .select('*')
    .eq('session_id', sessionId);

  if (error || !executions) return cheapest;

  const buckets = {};
  for (const execution of executions) {
    const category = execution.prompt_category || execution.category || 'general';
    const models = execution.models_used || [];
    const cost = safeNumber(execution.total_cost_usd ?? execution.total_cost);
    const each = cost / Math.max(models.length, 1);

    for (const model of models) {
      if (!availableIds.has(model)) continue;
      if (!buckets[category]) buckets[category] = {};
      if (!buckets[category][model]) buckets[category][model] = { cost: 0, count: 0 };
      buckets[category][model].cost += each;
      buckets[category][model].count += 1;
    }
  }

  Object.keys(buckets).forEach((category) => {
    let bestModel = null;
    let bestAvg = Number.POSITIVE_INFINITY;
    Object.keys(buckets[category]).forEach((model) => {
      const stats = buckets[category][model];
      const avg = stats.cost / Math.max(stats.count, 1);
      if (avg < bestAvg) {
        bestAvg = avg;
        bestModel = model;
      }
    });
    if (bestModel) cheapest[category] = bestModel;
  });

  return cheapest;
}

async function seedDemoData(sessionId) {
  const models = ['gpt-4o', 'claude-3-haiku-20240307', 'gemini-1.5-flash'];
  const categories = ['coding', 'research', 'general'];
  const statuses = ['completed', 'completed', 'completed', 'partial'];

  for (let i = 0; i < 6; i += 1) {
    const createdAt = new Date(Date.now() - (i * 6 * 60 * 60 * 1000)).toISOString();
    const model = models[i % models.length];
    const category = categories[i % categories.length];
    const cost = Number((0.004 + i * 0.001).toFixed(6));

    await supabase.from('executions').insert({
      id: require('crypto').randomUUID(),
      session_id: sessionId,
      plan_id: `demo-${i}`,
      prompt: `Demo prompt ${i}`,
      category,
      difficulty: 'medium',
      status: statuses[i % statuses.length],
      models_used: [model],
      total_tokens: 400 + i * 120,
      total_cost: cost,
      total_time_ms: 1200 + i * 200,
      created_at: createdAt
    }).then(({ error }) => {
      if (error) {
        console.warn('[analytics] demo seed insert failed:', error.message);
      }
    });
  }
}

module.exports = {
  upsertModelUsageStats,
  checkDailySpendCap,
  logExecution,
  getSessionSummary,
  getCheapestModelPerCategory,
  seedDemoData
};
