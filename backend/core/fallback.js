// Preference lists must reference models that are actually active in
// model_registry (see migrate_models_2026.js). Any id here that isn't active
// is silently dropped by the availability filter below — so a stale list
// collapses the fallback chain to just the assigned model. Each category
// intentionally spans multiple providers AND multiple tiers within a provider,
// so a single-provider user (e.g. Gemini-only) still gets same-provider
// fallbacks (2.5-pro -> 2.5-flash -> 2.0-flash) when the assigned model is
// rate-limited or unavailable.
const CATEGORY_PREFERENCE = {
  coding:   ['claude-sonnet-4-20250514', 'gpt-4.1', 'gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gpt-4o-mini', 'gemini-2.0-flash', 'claude-3-5-haiku-20241022'],
  research: ['claude-sonnet-4-20250514', 'gemini-2.5-pro', 'gpt-4.1', 'gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-2.5-flash', 'gemini-2.0-flash', 'claude-3-5-haiku-20241022'],
  math:     ['gpt-4.1', 'gemini-2.5-pro', 'gpt-4o', 'claude-sonnet-4-20250514', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gpt-4o-mini'],
  creative: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  planning: ['claude-sonnet-4-20250514', 'gpt-4.1', 'gemini-2.5-pro', 'gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  general:  ['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-2.0-flash', 'gpt-4o', 'gemini-2.5-pro'],
};

// Max models to attempt per subtask (assigned model + fallbacks).
const MAX_FALLBACK_CHAIN = 4;

function getFallbackOrder(category, assignedModelId, availableModels) {
  const preferred = CATEGORY_PREFERENCE[category] || CATEGORY_PREFERENCE.general;
  const ordered = [assignedModelId, ...preferred.filter(id => id !== assignedModelId)];
  const availableIds = new Set(availableModels.map(m => m.id));
  return ordered.filter(id => availableIds.has(id)).slice(0, MAX_FALLBACK_CHAIN);
}

module.exports = {
  getFallbackOrder
};
