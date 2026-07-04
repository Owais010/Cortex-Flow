/**
 * Generate a UUID v4 string
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Format a cost value as a dollar string
 * e.g. 0.0384 → "$0.0384"
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count with commas
 * e.g. 6000 → "6,000"
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Format tokens in short form
 * e.g. 6000 → "6k"
 */
export function formatTokensShort(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

/**
 * Format milliseconds to human readable
 * e.g. 22800 → "22.8s"
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format seconds to human readable
 * e.g. 24 → "~24s"
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `~${mins}m ${secs}s`;
}

/**
 * Get the current timestamp in ISO format
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Format an ISO timestamp to short time
 * e.g. "22:15"
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Map model name to provider name
 */
export function modelToProvider(model: string): string {
  if (model.includes('gpt')) return 'openai';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'google_gemini';
  return 'unknown';
}

/**
 * Get muted color for a provider
 */
export function getProviderColor(provider: string): string {
  switch (provider) {
    case 'openai': return 'var(--openai)';
    case 'anthropic': return 'var(--anthropic)';
    case 'google_gemini': return 'var(--gemini)';
    default: return 'var(--text-muted)';
  }
}

/**
 * Get muted color for a model name
 */
export function getModelColor(model: string): string {
  return getProviderColor(modelToProvider(model));
}

/**
 * Get or create session ID from localStorage
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return generateId();
  let sessionId = localStorage.getItem('agent_ascend_session_id');
  if (!sessionId) {
    sessionId = generateId();
    localStorage.setItem('agent_ascend_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Get difficulty badge color
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy': return 'var(--success)';
    case 'medium': return 'var(--warning)';
    case 'hard': return 'var(--error)';
    case 'agentic': return 'var(--accent)';
    default: return 'var(--text-muted)';
  }
}

/**
 * Get category display label
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    research: 'Research',
    coding: 'Coding',
    logic: 'Logic',
    creative: 'Creative',
    planning: 'Planning',
    math: 'Math',
    data: 'Data',
    general: 'General',
  };
  return labels[category.toLowerCase()] || category;
}
