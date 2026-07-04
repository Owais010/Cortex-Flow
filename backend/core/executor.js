const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { getFallbackOrder } = require('./fallback');
const { getProviderForModel } = require('../db/models');
const vault = require('../security/vault');
const { computeActualCost } = require('./token_counter');

async function callLLMProvider(provider, modelId, apiKey, prompt) {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: modelId,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });
    return {
      text: msg.content?.[0]?.text || '',
      usage: { input_tokens: msg.usage?.input_tokens || 0, output_tokens: msg.usage?.output_tokens || 0 }
    };
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048
    });
    return {
      text: res.choices?.[0]?.message?.content || '',
      usage: { input_tokens: res.usage?.prompt_tokens || 0, output_tokens: res.usage?.completion_tokens || 0 }
    };
  }

  if (provider === 'google_gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    let result;
    try {
      const model = genAI.getGenerativeModel({ model: modelId });
      result = await model.generateContent(prompt);
    } catch (err) {
      if (err.message.includes('404')) {
        console.warn(`[executor] ${modelId} returned 404. Attempting automatic fallbacks...`);
        const fallbacks = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'];
        let success = false;
        let lastErr = err;
        for (const fallbackId of fallbacks) {
          if (fallbackId === modelId) continue;
          try {
            const fbModel = genAI.getGenerativeModel({ model: fallbackId });
            result = await fbModel.generateContent(prompt);
            success = true;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!success) throw lastErr;
      } else {
        throw err;
      }
    }

    return {
      text: result.response.text() || '',
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount || 0,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function executeSubtask(subtask, availableModels, keyMap, category) {
  const modelsToTry = getFallbackOrder(category, subtask.assignedModel, availableModels);
  const errors = [];

  for (const modelId of modelsToTry) {
    const provider = getProviderForModel(modelId);
    const encryptedKey = keyMap[provider];
    if (!provider || !encryptedKey) {
      errors.push(`${modelId}: Missing API key`);
      continue;
    }

    const started = Date.now();
    const apiKey = vault.decryptKey(encryptedKey);

    try {
      const result = await callLLMProvider(provider, modelId, apiKey, subtask.prompt);
      const actualCost = computeActualCost(modelId, result.usage);

      return {
        subtaskId: subtask.id,
        modelUsed: modelId,
        wasFallback: modelId !== subtask.assignedModel,
        output: result.text,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        latencyMs: Date.now() - started,
        costUSD: actualCost,
        costINR: Number((actualCost * 83.5).toFixed(4))
      };
    } catch (error) {
      console.warn(`[executor] ${modelId} failed: ${error.message}`);
      errors.push(`${modelId} failed: ${error.message}`);
    }
  }

  throw new Error(`All models failed for subtask ${subtask.id}. Reasons: ${errors.join(', ')}`);
}

async function executePlan(plan, keyMap, availableModels) {
  const waveMap = {};
  for (const subtask of plan.subtasks || []) {
    const wave = subtask.wave || 0;
    if (!waveMap[wave]) waveMap[wave] = [];
    waveMap[wave].push(subtask);
  }

  const waves = Object.keys(waveMap).map(Number).sort((a, b) => a - b);
  const results = [];

  for (const waveIndex of waves) {
    for (const subtask of waveMap[waveIndex]) {
      const deps = subtask.dependsOn || [];
      const priorOutputs = results
        .filter((r) => deps.includes(r.subtaskId))
        .map((r) => `[Output from subtask ${r.subtaskId}]\n${r.output}`)
        .join('\n\n');

      const enrichedPrompt = priorOutputs
        ? `Context from previous steps:\n${priorOutputs}\n\nYour task:\n${subtask.prompt}`
        : subtask.prompt;

      try {
        const result = await executeSubtask(
          { ...subtask, prompt: enrichedPrompt },
          availableModels,
          keyMap,
          plan.category || 'general'
        );
        results.push(result);
      } catch (error) {
        console.error(`Execution failed on subtask ${subtask.id}: ${error.message}`);
        results.push({
          subtaskId: subtask.id,
          modelUsed: null,
          wasFallback: false,
          output: null,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          costUSD: 0,
          costINR: 0,
          error: error.message
        });
      }
    }
  }

  const validResults = results.filter((r) => r.output);
  const finalOutput = validResults
    .map((r) => `### Step ${r.subtaskId} (${r.modelUsed})\n${r.output}`)
    .join('\n\n---\n\n');

  return {
    subtaskResults: results,
    finalOutput,
    totalInputTokens: results.reduce((sum, r) => sum + (r.inputTokens || 0), 0),
    totalOutputTokens: results.reduce((sum, r) => sum + (r.outputTokens || 0), 0),
    totalCostUSD: Number(results.reduce((sum, r) => sum + (r.costUSD || 0), 0).toFixed(8)),
    totalCostINR: Number(results.reduce((sum, r) => sum + (r.costINR || 0), 0).toFixed(4)),
    totalLatencyMs: results.reduce((sum, r) => sum + (r.latencyMs || 0), 0),
    status: results.every((r) => r.output) ? 'completed' : 'partial'
  };
}

module.exports = {
  callLLMProvider,
  executeSubtask,
  executePlan
};
