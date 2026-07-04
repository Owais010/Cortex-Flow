import type { ConnectedProvider, AvailableModel, Plan, ExecutionResult, ConversationHistoryEntry, SharedContext } from './types';

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
  sessionId: string,
  conversationHistory: ConversationHistoryEntry[] = [],
  sharedContext: SharedContext = { facts: [], decisions: [] }
): Promise<Plan> {
  const res = await fetch(`${API_BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      prompt,
      available_models: availableModels,
      conversation_history: conversationHistory,
      shared_context: sharedContext,
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

// ── Chat persistence API ───────────────────────────────────────────────────

/** Sync auth user to public.users table */
export async function syncUser(userId: string, email: string, displayName?: string, avatarUrl?: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/chat/sync-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        email,
        display_name: displayName || '',
        avatar_url: avatarUrl || '',
      }),
    });
  } catch {
    console.error('Failed to sync user');
  }
}

/** Load all chat threads + messages for a user */
export async function loadChatThreads(userId: string): Promise<{ threads: Array<{ id: string; title: string; created_at: string; updated_at: string }>; messages: Array<{ id: string; thread_id: string; type: string; content: unknown; created_at: string }> } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/threads?user_id=${userId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Create a new chat thread */
export async function createChatThread(userId: string, title: string, email?: string, displayName?: string, avatarUrl?: string): Promise<{ id: string; title: string; created_at: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title,
        email: email || '',
        display_name: displayName || '',
        avatar_url: avatarUrl || '',
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Update a thread's title */
export async function updateChatThreadTitle(threadId: string, title: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/chat/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  } catch {
    console.error('Failed to update thread title');
  }
}

/** Delete a chat thread */
export async function deleteChatThread(threadId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/chat/threads/${threadId}`, {
      method: 'DELETE',
    });
  } catch {
    console.error('Failed to delete thread');
  }
}

/** Persist a message to the database */
export async function persistChatMessage(
  threadId: string,
  userId: string,
  messageId: string,
  type: string,
  content: Record<string, unknown>,
  createdAt: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message_id: messageId,
        type,
        content,
        created_at: createdAt,
      }),
    });
  } catch {
    console.error('Failed to persist message');
  }
}

/** Update a persisted message */
export async function updateChatMessage(
  messageId: string,
  updates: { type?: string; content?: Record<string, unknown>; created_at?: string },
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/chat/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    console.error('Failed to update message');
  }
}

