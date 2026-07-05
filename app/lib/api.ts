import type { ConnectedProvider, AvailableModel, Plan, ExecutionResult, ConversationHistoryEntry, SharedContext } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatThreadRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  thread_id: string;
  user_id: string;
  type: string;
  content: unknown;
  created_at: string;
}

export interface ChatUserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  return new Error(typeof data.error === 'string' ? data.error : fallback);
}

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
 * Ensure the authenticated Supabase user exists in public.users for chat FKs.
 */
export async function syncChatUser(profile: ChatUserProfile): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/sync-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: profile.id,
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
    }),
  });
  if (!res.ok) throw await parseError(res, 'Failed to sync chat user');
}

/**
 * Load all persisted chat threads and messages for a user.
 */
export async function getChatThreads(userId: string): Promise<{ threads: ChatThreadRow[]; messages: ChatMessageRow[] }> {
  const res = await fetch(`${API_BASE}/api/chat/threads?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw await parseError(res, 'Failed to load chat history');
  const data = await res.json();
  return {
    threads: data.threads || [],
    messages: data.messages || [],
  };
}

/**
 * Create a persisted chat thread. The client supplies the id so local state and DB stay aligned.
 */
export async function createChatThread(
  userId: string,
  threadId: string,
  title: string,
  profile?: ChatUserProfile
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: threadId,
      user_id: userId,
      title,
      email: profile?.email,
      display_name: profile?.displayName,
      avatar_url: profile?.avatarUrl,
    }),
  });
  if (!res.ok) throw await parseError(res, 'Failed to create chat thread');
}

export async function updateChatThreadTitle(threadId: string, title: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw await parseError(res, 'Failed to update chat thread');
}

export async function deleteChatThread(threadId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res, 'Failed to delete chat thread');
}

export async function saveChatMessage(
  userId: string,
  threadId: string,
  messageId: string,
  type: string,
  content: Record<string, unknown>,
  createdAt: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
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
  if (!res.ok) throw await parseError(res, 'Failed to save chat message');
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
  sessionId: string,
  conversationHistory: ConversationHistoryEntry[] = [],
  sharedContext: SharedContext = { facts: [], decisions: [] }
): Promise<ExecutionResult> {
  const res = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      plan,
      conversation_history: conversationHistory,
      shared_context: sharedContext,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Execution failed');
  }
  return res.json();
}

// ============================================
// Streaming execution (Server-Sent Events)
// ============================================

export interface SubtaskStartEvent {
  subtaskId: number;
  model: string;
  wave: number;
}
export interface SubtaskCompleteEvent {
  subtaskId: number;
  model: string;
  tokens: number;
  cost: number;
  latencyMs: number;
  wasFallback: boolean;
}
export interface SubtaskFailedEvent {
  subtaskId: number;
  error: string;
}

export interface ExecuteStreamHandlers {
  onStart?: (data: { planId: string; subtaskIds: number[] }) => void;
  onWaveStart?: (data: { wave: number; subtaskIds: number[] }) => void;
  onSubtaskStart?: (data: SubtaskStartEvent) => void;
  onSubtaskComplete?: (data: SubtaskCompleteEvent) => void;
  onSubtaskFailed?: (data: SubtaskFailedEvent) => void;
}

/**
 * Execute a plan and receive live per-subtask progress via SSE.
 * Resolves with the final ExecutionResult (from the `done` frame), or rejects
 * on an `error` frame / network failure. Falls back-friendly: callers can catch
 * and retry with the non-streaming executePlan().
 */
export async function executePlanStream(
  plan: Plan,
  sessionId: string,
  conversationHistory: ConversationHistoryEntry[] = [],
  sharedContext: SharedContext = { facts: [], decisions: [] },
  handlers: ExecuteStreamHandlers = {},
): Promise<ExecutionResult> {
  const res = await fetch(`${API_BASE}/api/execute/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      plan,
      conversation_history: conversationHistory,
      shared_context: sharedContext,
    }),
  });

  if (!res.ok || !res.body) {
    throw await parseError(res, 'Execution failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: ExecutionResult | null = null;
  let streamError: string | null = null;

  const dispatch = (event: string, data: unknown) => {
    switch (event) {
      case 'start':
        handlers.onStart?.(data as { planId: string; subtaskIds: number[] });
        break;
      case 'wave_start':
        handlers.onWaveStart?.(data as { wave: number; subtaskIds: number[] });
        break;
      case 'subtask_start':
        handlers.onSubtaskStart?.(data as SubtaskStartEvent);
        break;
      case 'subtask_complete':
        handlers.onSubtaskComplete?.(data as SubtaskCompleteEvent);
        break;
      case 'subtask_failed':
        handlers.onSubtaskFailed?.(data as SubtaskFailedEvent);
        break;
      case 'done':
        finalResult = data as ExecutionResult;
        break;
      case 'error':
        streamError = (data as { error?: string })?.error || 'Execution failed';
        break;
    }
  };

  // Parse one SSE block ("event: x\ndata: {...}") into a dispatch call.
  const handleBlock = (block: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      // lines starting with ':' are comments/heartbeats — ignored
    }
    if (dataLines.length === 0) return;
    try {
      dispatch(event, JSON.parse(dataLines.join('\n')));
    } catch {
      /* ignore malformed frame */
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (block.trim()) handleBlock(block);
    }
  }
  if (buffer.trim()) handleBlock(buffer);

  if (streamError) throw new Error(streamError);
  if (!finalResult) throw new Error('Execution ended without a result');
  return finalResult;
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



