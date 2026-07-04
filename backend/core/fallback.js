const CATEGORY_PREFERENCE = {
  coding:   ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro', 'gpt-4o-mini', 'claude-3-haiku-20240307'],
  research: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro', 'claude-3-haiku-20240307'],
  math:     ['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet-20241022', 'gpt-4o-mini'],
  creative: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-flash'],
  planning: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'gemini-1.5-pro'],
  general:  ['gemini-1.5-flash', 'gpt-4o-mini', 'claude-3-haiku-20240307'],
};

function getFallbackOrder(category, assignedModelId, availableModels) {
  const preferred = CATEGORY_PREFERENCE[category] || CATEGORY_PREFERENCE.general;
  const ordered = [assignedModelId, ...preferred.filter(id => id !== assignedModelId)];
  const availableIds = new Set(availableModels.map(m => m.id));
  return ordered.filter(id => availableIds.has(id)).slice(0, 3);
}

module.exports = {
  getFallbackOrder
};
