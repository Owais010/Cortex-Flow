const supabase = require("./supabase");

async function getAvailableModels(sessionId) {
  // Query api_key_vault
  const { data: keys, error: keysError } = await supabase
    .from("api_key_vault")
    .select("provider")
    .eq("session_id", sessionId)
    .eq("is_valid", true)
    .is("revoked_at", null);

  if (keysError) {
    console.warn("[getAvailableModels] Error fetching keys:", keysError);
    return [];
  }

  if (!keys || keys.length === 0) {
    return [];
  }

  const providers = keys.map(k => k.provider);

  // Query model_registry
  const { data: models, error: modelsError } = await supabase
    .from("model_registry")
    .select("*")
    .in("provider", providers)
    .eq("is_active", true);

  if (modelsError) {
    console.warn("[getAvailableModels] Error fetching models:", modelsError);
    return [];
  }

  const normalizedModels = [];
  const validProviders = ["openai", "anthropic", "google_gemini"];

  for (const row of models || []) {
    try {
      let parsedStrengths = row.strengths;
      if (typeof parsedStrengths === 'string') {
        parsedStrengths = parsedStrengths.split(',').map(s => s.trim());
      } else if (!Array.isArray(parsedStrengths)) {
        parsedStrengths = [];
      }

      const model = {
        id: row.model_id,
        provider: row.provider,
        displayName: row.display_name,
        strengths: parsedStrengths,
        contextWindow: row.context_window,
        inputCostPer1k: parseFloat(row.cost_per_1k_input),
        outputCostPer1k: parseFloat(row.cost_per_1k_output),
        supportsStreaming: row.supports_streaming ?? true,
        isActive: row.is_active ?? true
      };

      // Validation
      if (typeof model.id !== 'string' || model.id.trim() === '') {
        throw new Error(`Invalid model id`);
      }
      if (!validProviders.includes(model.provider)) {
        throw new Error(`Invalid provider: ${model.provider}`);
      }
      if (!Number.isFinite(model.inputCostPer1k) || model.inputCostPer1k < 0) {
        throw new Error(`Invalid inputCostPer1k: ${model.inputCostPer1k}`);
      }

      normalizedModels.push(model);
    } catch (err) {
      console.warn(`[getAvailableModels] Validation failed for model ${row.model_id}: ${err.message}. Skipping.`);
    }
  }

  return normalizedModels;
}

async function getModelById(modelId, sessionId) {
  try {
    const availableModels = await getAvailableModels(sessionId);
    const model = availableModels.find(m => m.id === modelId);
    return model || null;
  } catch (err) {
    console.warn(`[getModelById] Error: ${err.message}`);
    return null;
  }
}

function getProviderForModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  const id = modelId.toLowerCase();
  if (id.startsWith('claude')) return 'anthropic';
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3')) return 'openai';
  if (id.startsWith('gemini')) return 'google_gemini';
  return null;
}

module.exports = {
  getAvailableModels,
  getModelById,
  getProviderForModel
};
