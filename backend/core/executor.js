const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { getFallbackOrder } = require('./fallback');
const { getProviderForModel } = require('../db/models');
const vault = require('../security/vault');
const { computeActualCost } = require('./token_counter');
const { readContext, writeContext } = require('./memory');

// Longest server-suggested rate-limit delay we're willing to wait inline before
// giving up on a model and falling back to another. Anything longer would stall
// the whole execution (and the SSE stream), so we switch models instead.
const MAX_RETRY_WAIT_MS = Number(process.env.GEMINI_MAX_RETRY_WAIT_MS || 6000);

// Same-provider fallback chain used when a Gemini model is unavailable (404) or
// rate-limited (429). Ordered cheapest-reliable-first after the pro tier.
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract an HTTP-ish status code and any server-suggested retry delay from a
 * Google Generative AI SDK error. The SDK surfaces these as text, e.g.
 * "[429 Too Many Requests] ... "retryDelay":"27s" ... Please retry in 27.7s".
 */
function classifyGeminiError(err) {
  const msg = String(err?.message || '');
  let status = 0;
  const statusMatch = msg.match(/\[(\d{3})\s/);
  if (statusMatch) status = Number(statusMatch[1]);
  else if (/quota|rate limit|too many requests/i.test(msg)) status = 429;
  else if (/not found|\b404\b/i.test(msg)) status = 404;

  const jsonDelay = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const textDelay = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  const secs = jsonDelay ? Number(jsonDelay[1]) : (textDelay ? Number(textDelay[1]) : 0);
  const retryDelayMs = Number.isFinite(secs) && secs > 0 ? Math.ceil(secs * 1000) : 0;

  return { status, retryDelayMs };
}

/**
 * Generate content with a Gemini model, transparently recovering from a bad/
 * retired model id (404) or a quota/rate-limit hit (429) by switching to a
 * sibling Gemini model. For a 429 that carries a short server-suggested delay,
 * we wait once and retry the same model before falling back. Returns both the
 * SDK result and the id of the model that actually produced it so the caller
 * can report/cost the real model.
 */
async function generateGeminiContent(genAI, requestedModelId, prompt) {
  const generateOnce = async (id) => {
    const model = genAI.getGenerativeModel({ model: id });
    return model.generateContent(prompt);
  };

  try {
    return { result: await generateOnce(requestedModelId), modelUsed: requestedModelId };
  } catch (err) {
    const { status, retryDelayMs } = classifyGeminiError(err);

    // Only a retired-model 404 or a quota/rate-limit 429 is recoverable by
    // switching models. Anything else (auth, bad request, server error) is a
    // real failure and bubbles up to the cross-model loop in executeSubtask.
    if (status !== 404 && status !== 429) throw err;

    let lastErr = err;

    // Short rate-limit delay: honor it once for the requested model before
    // falling back. Long delays are skipped so we don't stall the execution.
    if (status === 429 && retryDelayMs > 0 && retryDelayMs <= MAX_RETRY_WAIT_MS) {
      console.warn(`[executor] ${requestedModelId} rate-limited; waiting ${retryDelayMs}ms for one retry...`);
      await sleep(retryDelayMs);
      try {
        return { result: await generateOnce(requestedModelId), modelUsed: requestedModelId };
      } catch (retryErr) {
        lastErr = retryErr;
      }
    }

    console.warn(`[executor] ${requestedModelId} unavailable (status ${status}); trying Gemini fallbacks...`);
    for (const fallbackId of GEMINI_FALLBACK_MODELS) {
      if (fallbackId === requestedModelId) continue;
      try {
        return { result: await generateOnce(fallbackId), modelUsed: fallbackId };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }
}

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
      modelUsed: modelId,
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
      modelUsed: modelId,
      usage: { input_tokens: res.usage?.prompt_tokens || 0, output_tokens: res.usage?.completion_tokens || 0 }
    };
  }

  if (provider === 'google_gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    const { result, modelUsed } = await generateGeminiContent(genAI, modelId, prompt);

    return {
      text: result.response.text() || '',
      modelUsed,
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
      // The provider may have transparently switched models (e.g. Gemini
      // same-provider fallback on 404/429). Report and cost the model that
      // actually produced the output, not the one we asked for.
      const modelUsed = result.modelUsed || modelId;
      const actualCost = computeActualCost(modelUsed, result.usage);

      return {
        subtaskId: subtask.id,
        modelUsed,
        wasFallback: modelUsed !== subtask.assignedModel,
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

function truncateContextText(text, maxLength = 6000) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[truncated]`;
}

function buildSessionMemoryBlock(conversationHistory = [], sharedContext = { facts: [], decisions: [] }, storedContext = { facts: [], decisions: [] }) {
  const blocks = [];
  const facts = [
    ...(Array.isArray(storedContext?.facts) ? storedContext.facts : []),
    ...(Array.isArray(sharedContext?.facts) ? sharedContext.facts : [])
  ];
  const decisions = [
    ...(Array.isArray(storedContext?.decisions) ? storedContext.decisions : []),
    ...(Array.isArray(sharedContext?.decisions) ? sharedContext.decisions : [])
  ];

  if (facts.length > 0 || decisions.length > 0) {
    blocks.push([
      'Known session context:',
      ...facts.slice(-20).map((fact) => `- Fact: ${fact}`),
      ...decisions.slice(-10).map((decision) => `- Decision: ${decision}`)
    ].join('\n'));
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const turns = conversationHistory.slice(-6).map((entry, idx) => {
      const response = entry.response || entry.resultSummary || '';
      return [
        `Turn ${idx + 1}`,
        `User: ${truncateContextText(entry.prompt, 1200)}`,
        response ? `Assistant/model response: ${truncateContextText(response)}` : null
      ].filter(Boolean).join('\n');
    });
    blocks.push(`Conversation transcript for this session:\n${turns.join('\n\n')}`);
  }

  if (blocks.length === 0) return '';
  return `${blocks.join('\n\n')}\n\nUse this session memory to resolve references like "it", "that", "previous response", and "summarize it".\n\n`;
}

async function executePlan(plan, keyMap, availableModels, sessionId, executionContext = {}, onEvent) {
  // onEvent is an optional callback used for live streaming. It is called with
  // { type, ... } payloads as subtasks start and settle. When omitted the
  // function behaves exactly as before (single batched result).
  const emit = typeof onEvent === 'function' ? onEvent : () => {};
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
  let storedContext = { facts: [], decisions: [] };
  if (sessionId) {
    storedContext = await readContext(sessionId);
  }
  const sessionMemoryBlock = buildSessionMemoryBlock(
    executionContext.conversationHistory || [],
    executionContext.sharedContext || { facts: [], decisions: [] },
    storedContext
  );

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
    emit({ type: 'wave_start', wave: waveIndex, subtaskIds: waveSubtasks.map((s) => s.id) });

    const wavePromises = waveSubtasks.map((subtask) => {
      const deps = subtask.dependsOn || [];
      const priorOutputs = results
        .filter((r) => deps.includes(r.subtaskId))
        .map((r) => `[Output from subtask ${r.subtaskId}]\n${r.output}`)
        .join('\n\n');

      const enrichedPrompt = sessionMemoryBlock + (priorOutputs
        ? `Context from previous steps:\n${priorOutputs}\n\nYour task:\n${subtask.prompt}`
        : subtask.prompt);

      // Signal that this subtask is now running (its whole wave starts together).
      emit({ type: 'subtask_start', subtaskId: subtask.id, model: subtask.assignedModel, wave: waveIndex });

      return executeSubtask(
        { ...subtask, prompt: enrichedPrompt },
        availableModels,
        keyMap,
        plan.category || 'general'
      )
        .then((value) => {
          // Emit as soon as THIS subtask settles, not after the whole wave.
          emit({
            type: 'subtask_complete',
            subtaskId: value.subtaskId,
            model: value.modelUsed,
            tokens: (value.inputTokens || 0) + (value.outputTokens || 0),
            cost: value.costUSD || 0,
            latencyMs: value.latencyMs || 0,
            wasFallback: value.wasFallback || false,
          });
          return value;
        })
        .catch((error) => {
          emit({
            type: 'subtask_failed',
            subtaskId: subtask.id,
            error: error?.message || String(error),
          });
          throw error;
        });
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
