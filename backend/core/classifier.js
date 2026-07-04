const CATEGORIES = ['research', 'coding', 'logic', 'creative', 'planning', 'math', 'general'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'agentic'];

const CATEGORY_KEYWORDS = {
  coding: ['code', 'bug', 'debug', 'api', 'function', 'refactor', 'typescript', 'javascript', 'python'],
  math: ['equation', 'calculate', 'proof', 'algebra', 'matrix', 'derivative', 'integral', 'math'],
  research: ['research', 'market', 'analysis', 'compare', 'study', 'report', 'benchmark'],
  planning: ['plan', 'roadmap', 'milestone', 'timeline', 'strategy', 'step by step'],
  creative: ['story', 'poem', 'creative', 'script', 'copywriting', 'brand voice'],
  logic: ['reason', 'logic', 'argue', 'deduce', 'constraint', 'decision']
};

function scoreCategories(promptLower) {
  const scores = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (promptLower.includes(keyword)) {
        scores[category] += 1;
      }
    }
  }
  return scores;
}

function estimateDifficulty(prompt) {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  const complexityMarkers = [
    'end-to-end', 'architecture', 'multi', 'integrate', 'production',
    'fallback', 'analytics', 'streaming', 'orchestrate'
  ];
  const markerHits = complexityMarkers.reduce((count, marker) => count + (lower.includes(marker) ? 1 : 0), 0);

  if (wordCount > 140 || markerHits >= 4) return 'agentic';
  if (wordCount > 70 || markerHits >= 2) return 'hard';
  if (wordCount > 30 || markerHits >= 1) return 'medium';
  return 'easy';
}

function classifyPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Prompt must be a non-empty string');
  }

  const lower = trimmed.toLowerCase();
  const scores = scoreCategories(lower);
  const bestCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const category = bestCategory && bestCategory[1] > 0 ? bestCategory[0] : 'general';
  const difficulty = estimateDifficulty(trimmed);
  const needsDecomposition = difficulty === 'hard' || difficulty === 'agentic';

  return {
    category,
    difficulty,
    needsDecomposition
  };
}

module.exports = {
  classifyPrompt
};
