import type { ConnectedProvider, AvailableModel, Plan, ExecutionResult } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Check if backend is running
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Submit an API key for a provider
 */
export async function submitKey(
  provider: string,
  apiKey: string,
  sessionId: string
): Promise<ConnectedProvider> {
  const res = await fetch(`${API_BASE}/api/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey, session_id: sessionId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to submit key');
  }
  return res.json();
}

/**
 * Get available models for a session
 */
export async function getModels(sessionId: string): Promise<AvailableModel[]> {
  const res = await fetch(`${API_BASE}/api/keys/models?session_id=${sessionId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.models || [];
}

/**
 * Generate an execution plan for a prompt
 */
export async function generatePlan(
  prompt: string,
  availableModels: string[],
  sessionId: string
): Promise<Plan> {
  const res = await fetch(`${API_BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      prompt,
      available_models: availableModels,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to generate plan');
  }
  return res.json();
}

/**
 * Execute an approved plan
 */
export async function executePlan(
  plan: Plan,
  sessionId: string
): Promise<ExecutionResult> {
  const res = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      plan,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Execution failed');
  }
  return res.json();
}

/**
 * Edit a plan's subtasks (model, prompt, title) and get recalculated estimates
 */
export interface PlanEdit {
  subtaskId: number;
  field: 'assignedModel' | 'prompt' | 'title';
  value: string;
}

export async function editPlan(
  planId: string,
  edits: PlanEdit[],
  sessionId: string
): Promise<Plan> {
  const res = await fetch(`${API_BASE}/api/plan/${planId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      edits,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to edit plan');
  }
  return res.json();
}
