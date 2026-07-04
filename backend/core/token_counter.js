const config = require('../config');
const supabase = require('../db/supabase');

const PRICING = {
  'gpt-4o': { inputPer1k: 0.0050, outputPer1k: 0.0150, speed: 40 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006, speed: 80 },
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.0030, outputPer1k: 0.0150, speed: 50 },
  'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125, speed: 90 },
  'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.0050, speed: 45 },
  'gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003, speed: 100 },
  'gemini-2.0-flash': { inputPer1k: 0.0001, outputPer1k: 0.0004, speed: 110 },
};

const FALLBACK_PRICE = { inputPer1k: 0.0025, outputPer1k: 0.0100, speed: 40 };

function estimateTokens(text) {
  const input = Math.max(1, Math.ceil(String(text || '').length / 4));
  const output = Math.max(60, Math.ceil(input * 1.6));
  return { input, output };
}

function resolvePricing(modelId, availableModels = []) {
  if (PRICING[modelId]) return PRICING[modelId];
  const fromDb = availableModels.find((m) => m.id === modelId);
  if (fromDb) {
    return {
      inputPer1k: Number(fromDb.inputCostPer1k || fromDb.cost_per_1k_input || FALLBACK_PRICE.inputPer1k),
      outputPer1k: Number(fromDb.outputCostPer1k || fromDb.cost_per_1k_output || FALLBACK_PRICE.outputPer1k),
      speed: 50
    };
  }
  return FALLBACK_PRICE;
}

function estimateCost(modelId, prompt, availableModels = []) {
  const pricing = resolvePricing(modelId, availableModels);
  const tokens = estimateTokens(prompt);

  const estimatedCostUSD = Number(((tokens.input / 1000) * pricing.inputPer1k + (tokens.output / 1000) * pricing.outputPer1k).toFixed(6));
  const estimatedCostINR = Number((estimatedCostUSD * 83.5).toFixed(4));
  const estimatedLatencyMs = Math.max(800, Math.round((tokens.output / Math.max(pricing.speed, 1)) * 1000));

  return {
    estimatedInputTokens: tokens.input,
    estimatedOutputTokens: tokens.output,
    estimatedCostUSD,
    estimatedCostINR,
    estimatedLatencyMs
  };
}

function estimateTokensAndCost(prompt, modelId) {
  const estimate = estimateCost(modelId, prompt);
  return {
    inputTokens: estimate.estimatedInputTokens,
    outputTokens: estimate.estimatedOutputTokens,
    tokens: estimate.estimatedInputTokens + estimate.estimatedOutputTokens,
    cost: Number(estimate.estimatedCostUSD.toFixed(4)),
    timeSeconds: Math.max(3, Math.round(estimate.estimatedLatencyMs / 1000))
  };
}

function computeActualCost(modelId, usage) {
  const pricing = resolvePricing(modelId);
  const input = Number(usage?.input_tokens || 0);
  const output = Number(usage?.output_tokens || 0);
  return Number(((input / 1000) * pricing.inputPer1k + (output / 1000) * pricing.outputPer1k).toFixed(8));
}

function aggregatePlanCost(subtasks) {
  const totals = (subtasks || []).reduce((acc, task) => {
    acc.totalEstimatedCostUSD += Number(task.estimatedCostUSD || 0);
    acc.totalEstimatedCostINR += Number(task.estimatedCostINR || 0);
    acc.totalEstimatedInputTokens += Number(task.estimatedInputTokens || 0);
    acc.totalEstimatedOutputTokens += Number(task.estimatedOutputTokens || 0);
    acc.totalEstimatedLatencyMs += Number(task.estimatedLatencyMs || 0);
    return acc;
  }, {
    totalEstimatedCostUSD: 0,
    totalEstimatedCostINR: 0,
    totalEstimatedInputTokens: 0,
    totalEstimatedOutputTokens: 0,
    totalEstimatedLatencyMs: 0
  });

  return {
    ...totals,
    totalEstimatedTokens: totals.totalEstimatedInputTokens + totals.totalEstimatedOutputTokens
  };
}

async function checkSpendCap(sessionId) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('executions')
    .select('*')
    .eq('session_id', sessionId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lt('created_at', `${today}T23:59:59.999Z`);

  if (error) {
    return {
      allowed: true,
      todaySpend: 0,
      remaining: config.dailyCapUSD,
      message: 'Spend cap check unavailable'
    };
  }

  const todaySpend = (data || []).reduce((sum, row) => {
    const cost = row.total_cost_usd ?? row.total_cost ?? 0;
    return sum + Number(cost || 0);
  }, 0);

  const remaining = Number((config.dailyCapUSD - todaySpend).toFixed(6));
  return {
    allowed: todaySpend < config.dailyCapUSD,
    todaySpend: Number(todaySpend.toFixed(6)),
    remaining: Math.max(0, remaining),
    message: todaySpend < config.dailyCapUSD
      ? 'Within daily spend cap'
      : `Daily spend cap of $${config.dailyCapUSD} reached`
  };
}

module.exports = {
  estimateTokens,
  estimateCost,
  estimateTokensAndCost,
  computeActualCost,
  aggregatePlanCost,
  checkSpendCap,
  PRICING,
  FALLBACK_PRICE
};
