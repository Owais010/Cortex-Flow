const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { getFallbackOrder } = require('./fallback');
const { getProviderForModel } = require('../db/models');
const vault = require('../security/vault');
const { computeActualCost } = require('./token_counter');
const { readContext, writeContext } = require('./memory');

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

async function executePlan(plan, keyMap, availableModels, sessionId) {
  // Dynamically compute wave assignments to ensure dependent tasks are correctly ordered
  const subtasks = plan.subtasks || [];
  const waveOf = {};
  function computeWave(taskId, visited = new Set()) {
    if (waveOf[taskId] !== undefined) return waveOf[taskId];
    if (visited.has(taskId)) return 0; // cycle guard
    visited.add(taskId);
    const task = subtasks.find(t => t.id === taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      waveOf[taskId] = 0;
      return 0;
    }
    const maxDepWave = Math.max(...task.dependsOn.map(depId => computeWave(depId, visited)));
    waveOf[taskId] = maxDepWave + 1;
    return waveOf[taskId];
  }
  for (const task of subtasks) {
    computeWave(task.id);
    task.wave = waveOf[task.id];
  }

  const waveMap = {};
  for (const subtask of subtasks) {
    const wave = subtask.wave;
    if (!waveMap[wave]) waveMap[wave] = [];
    waveMap[wave].push(subtask);
  }

  const waves = Object.keys(waveMap).map(Number).sort((a, b) => a - b);
  const results = [];

  // Read session context once at the start (only if sessionId is provided)
  let factsBlock = '';
  if (sessionId) {
    const context = await readContext(sessionId);
    if (context.facts.length > 0) {
      factsBlock = `Known context:\n${context.facts.join('\n')}\n\n`;
    }
  }

  for (const waveIndex of waves) {
    // Step 1: Validate wave independence — no subtask may depend on a sibling in the same wave
    const waveSubtasks = waveMap[waveIndex];
    const waveIds = new Set(waveSubtasks.map((s) => s.id));
    for (const subtask of waveSubtasks) {
      const deps = subtask.dependsOn || [];
      for (const depId of deps) {
        if (waveIds.has(depId)) {
          throw new Error(
            `Wave ${waveIndex} contains an intra-wave dependency: subtask ${subtask.id} depends on subtask ${depId}, but both are in the same wave. Dependent tasks must be in a later wave.`
          );
        }
      }
    }

    // Step 2: Execute all subtasks in this wave concurrently (they are verified independent)
    const wavePromises = waveSubtasks.map((subtask) => {
      const deps = subtask.dependsOn || [];
      const priorOutputs = results
        .filter((r) => deps.includes(r.subtaskId))
        .map((r) => `[Output from subtask ${r.subtaskId}]\n${r.output}`)
        .join('\n\n');

      const enrichedPrompt = factsBlock + (priorOutputs
        ? `Context from previous steps:\n${priorOutputs}\n\nYour task:\n${subtask.prompt}`
        : subtask.prompt);

      return executeSubtask(
        { ...subtask, prompt: enrichedPrompt },
        availableModels,
        keyMap,
        plan.category || 'general'
      );
    });

    const outcomes = await Promise.allSettled(wavePromises);

    // Reassemble results in original subtask order (allSettled preserves input order)
    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        const failedSubtask = waveSubtasks[i];
        console.error(`Execution failed on subtask ${failedSubtask.id}: ${outcome.reason?.message || outcome.reason}`);
        results.push({
          subtaskId: failedSubtask.id,
          modelUsed: null,
          wasFallback: false,
          output: null,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          costUSD: 0,
          costINR: 0,
          error: outcome.reason?.message || String(outcome.reason)
        });
      }
    }
  }

  const validResults = results.filter((r) => r.output);
  const finalOutput = validResults
    .map((r) => `### Step ${r.subtaskId} (${r.modelUsed})\n${r.output}`)
    .join('\n\n---\n\n');

  const executionResult = {
    subtaskResults: results,
    finalOutput,
    totalInputTokens: results.reduce((sum, r) => sum + (r.inputTokens || 0), 0),
    totalOutputTokens: results.reduce((sum, r) => sum + (r.outputTokens || 0), 0),
    totalCostUSD: Number(results.reduce((sum, r) => sum + (r.costUSD || 0), 0).toFixed(8)),
    totalCostINR: Number(results.reduce((sum, r) => sum + (r.costINR || 0), 0).toFixed(4)),
    totalLatencyMs: results.reduce((sum, r) => sum + (r.latencyMs || 0), 0),
    status: results.every((r) => r.output) ? 'completed' : 'partial'
  };

  // Write memorable facts only if the plan explicitly flagged them
  if (sessionId && Array.isArray(plan.memorableFacts) && plan.memorableFacts.length > 0) {
    await writeContext(sessionId, { facts: plan.memorableFacts });
  }

  return executionResult;
}

module.exports = {
  callLLMProvider,
  executeSubtask,
  executePlan
};
