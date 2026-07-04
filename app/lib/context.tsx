'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Chat,
  Message,
  ConnectedProvider,
  Plan,
  ConversationHistoryEntry,
} from './types';
import { generateId, now, truncate, getSessionId } from './utils';
import { createClient } from './supabase';
import * as api from './api';
import type { User } from '@supabase/supabase-js';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Deserialise a raw chat_messages row into a typed Message */
function rowToMessage(row: { id: string; type: string; content: unknown; created_at: string }): Message {
  const payload = row.content as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as Message['type'],
    timestamp: row.created_at,
    ...payload,
  } as Message;
}

/** Serialise a Message into the jsonb `content` column (everything except id / type / timestamp) */
function messageToContent(msg: Message): Record<string, unknown> {
  const { id: _id, type: _type, timestamp: _ts, ...rest } = msg as Record<string, unknown>;
  return rest;
}

/** System welcome message added locally – never persisted */
function welcomeMessage(): Message {
  return {
    id: generateId(),
    type: 'system',
    content: "Welcome to Cortex Flow. Describe your task and I'll route it to the best AI models.",
    timestamp: now(),
  } as Message;
}

// ─── types ──────────────────────────────────────────────────────────────────

interface ChatContextType extends AppState {
  user: User | null;
  isLoadingChats: boolean;
  addChat: () => Promise<string>;
  setActiveChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  addMessage: (chatId: string, message: Message) => Promise<void>;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  approvePlan: (chatId: string, messageId: string, plan: Plan) => Promise<void>;
  connectProvider: (provider: string, apiKey: string) => Promise<ConnectedProvider>;
  refreshModels: () => Promise<void>;
  checkBackend: () => Promise<void>;
  logout: () => Promise<void>;
  cancelPlan: (chatId: string, messageId: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}

// ─── provider ───────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [state, setState] = useState<AppState>({
    sessionId: '',
    connectedProviders: [],
    availableModels: [],
    chats: [],
    activeChatId: null,
    isLoading: false,
    isExecuting: false,
    backendOnline: false,
    conversationHistory: [],
    sharedContext: { facts: [], decisions: [] },
  });

  // Track which message IDs are already persisted so updateMessage can do an
  // upsert-style UPDATE instead of a duplicate INSERT.
  const persistedMsgIds = useRef<Set<string>>(new Set());
  const lastInitializedUserId = useRef<string | null>(null);

  // ── Chat persistence via backend API ──────────────────────────────────────

  /** Load all threads + their messages for the logged-in user via backend */
  const loadChatsFromBackend = useCallback(async (userId: string) => {
    setIsLoadingChats(true);
    try {
      const result = await api.loadChatThreads(userId);
      if (!result || !result.threads || result.threads.length === 0) {
        setIsLoadingChats(false);
        return null;
      }

      // Mark all loaded message IDs as persisted
      (result.messages ?? []).forEach(r => persistedMsgIds.current.add(r.id));

      // Group messages by thread
      const msgsByThread: Record<string, Message[]> = {};
      for (const row of result.messages ?? []) {
        if (!msgsByThread[row.thread_id]) msgsByThread[row.thread_id] = [];
        msgsByThread[row.thread_id].push(rowToMessage(row));
      }

      const chats: Chat[] = result.threads.map(t => ({
        id: t.id,
        title: t.title,
        createdAt: t.created_at,
        messages: [
          welcomeMessage(),
          ...(msgsByThread[t.id] ?? []),
        ],
      }));

      return chats;
    } catch (err) {
      console.error('Exception in loadChatsFromBackend:', err);
      return null;
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  /** Create a new thread row via backend API and return its ID */
  const createThreadViaBackend = useCallback(async (userId: string, title = 'New Chat'): Promise<string> => {
    const currentUser = user;
    const result = await api.createChatThread(
      userId,
      title,
      currentUser?.email || '',
      currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '',
      currentUser?.user_metadata?.avatar_url || '',
    );
    if (result) {
      return result.id;
    }
    // Fallback: generate a local ID if backend fails
    console.error('Failed to create thread via backend, using local ID');
    return generateId();
  }, [user]);

  /** Update the thread title via backend */
  const updateThreadTitle = useCallback(async (threadId: string, title: string) => {
    await api.updateChatThreadTitle(threadId, title);
  }, []);

  /** Insert a single message row via backend */
  const persistMessage = useCallback(async (
    userId: string,
    threadId: string,
    msg: Message,
  ) => {
    if (persistedMsgIds.current.has(msg.id)) return; // already saved
    // Skip ephemeral system welcome messages
    if (msg.type === 'system') return;

    await api.persistChatMessage(
      threadId,
      userId,
      msg.id,
      msg.type,
      messageToContent(msg),
      msg.timestamp,
    );
    persistedMsgIds.current.add(msg.id);
  }, []);

  /** Update an existing message row via backend */
  const updatePersistedMessage = useCallback(async (
    msgId: string,
    updates: Partial<Message>,
  ) => {
    if (!persistedMsgIds.current.has(msgId)) return;
    const { type, timestamp, id: _id, ...rest } = updates as Record<string, unknown>;
    await api.updateChatMessage(msgId, {
      ...(type ? { type: type as string } : {}),
      ...(timestamp ? { created_at: timestamp as string } : {}),
      content: rest as Record<string, unknown>,
    });
  }, []);

  // ── Initialise ────────────────────────────────────────────────────────────

  const initializeForUser = useCallback(async (userId: string, isAuthUser: boolean) => {
    if (lastInitializedUserId.current === userId) return;
    lastInitializedUserId.current = userId;

    setState(prev => ({ ...prev, sessionId: userId }));

    if (isAuthUser) {
      // Sync user to public.users via backend (handles FK constraint)
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await api.syncUser(
          currentUser.id,
          currentUser.email || '',
          currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '',
          currentUser.user_metadata?.avatar_url || '',
        );
      }

      // Load chats via backend API (uses service role key, bypasses RLS)
      const persisted = await loadChatsFromBackend(userId);
      if (persisted && persisted.length > 0) {
        setState(prev => ({
          ...prev,
          sessionId: userId,
          chats: persisted,
          activeChatId: prev.activeChatId && persisted.find(c => c.id === prev.activeChatId)
            ? prev.activeChatId
            : persisted[0].id,
        }));
      } else {
        // No saved chats — show empty state; thread created on first prompt
        setState(prev => ({
          ...prev,
          sessionId: userId,
          chats: [],
          activeChatId: null,
        }));
      }
    } else {
      // Guest: keep local chats only, load from localStorage
      let localChats: Chat[] = [];
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cortex_flow_guest_chats');
        if (stored) {
          try {
            localChats = JSON.parse(stored);
          } catch (e) {
            console.error('Error parsing guest chats:', e);
          }
        }
      }
      setState(prev => ({
        ...prev,
        sessionId: userId,
        chats: localChats.length > 0 ? localChats : (prev.chats.length > 0 ? prev.chats : []),
        activeChatId: prev.activeChatId || (localChats.length > 0 ? localChats[0].id : null),
      }));
    }

    // Backend health + models
    api.healthCheck().then(online => {
      setState(prev => ({ ...prev, backendOnline: online }));
      if (online) {
        api.getModels(userId).then(models => {
          const providers = Array.from(new Set(models.map(m => m.provider))).map(p => ({
            provider: p as ConnectedProvider['provider'],
            status: 'active' as const,
            hint: 'Loaded from backend',
            validated_at: new Date().toISOString(),
          }));
          setState(prev => ({ ...prev, availableModels: models, connectedProviders: providers }));
        });
      }
    });
  }, [loadChatsFromBackend]);

  // Auth listener
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      if (u) {
        initializeForUser(u.id, true);
      } else {
        initializeForUser(getSessionId(), false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        initializeForUser(u.id, true);
      } else {
        initializeForUser(getSessionId(), false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeForUser]);

  // Persist guest chats to localStorage
  useEffect(() => {
    if (!user && state.sessionId) {
      localStorage.setItem('cortex_flow_guest_chats', JSON.stringify(state.chats));
    }
  }, [state.chats, user, state.sessionId]);

  // ── Chat CRUD ─────────────────────────────────────────────────────────────

  const addChat = useCallback(async (): Promise<string> => {
    const welcome = welcomeMessage();
    let newId: string;

    if (user) {
      newId = await createThreadViaBackend(user.id, 'New Chat');
    } else {
      newId = generateId();
    }

    const newChat: Chat = {
      id: newId,
      title: 'New Chat',
      messages: [welcome],
      createdAt: now(),
    };

    setState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      activeChatId: newId,
    }));

    return newId;
  }, [user, createThreadViaBackend]);

  const setActiveChat = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeChatId: id }));
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    if (user) {
      await api.deleteChatThread(id);
    }

    setState(prev => {
      const filtered = prev.chats.filter(c => c.id !== id);
      let newActiveId = prev.activeChatId;
      if (prev.activeChatId === id) {
        newActiveId = filtered[0]?.id ?? null;
      }
      return { ...prev, chats: filtered, activeChatId: newActiveId };
    });
  }, [user]);

  // ── Message ops ───────────────────────────────────────────────────────────

  const addMessage = useCallback(async (chatId: string, message: Message) => {
    // If this is the first real message in a thread that has no DB row yet,
    // create the thread first.
    if (user && message.type === 'user') {
      // Ensure thread exists — try creating via backend (it handles duplicates)
      const currentUser = user;
      await api.createChatThread(
        currentUser.id,
        truncate((message as { content: string }).content, 40),
        currentUser.email || '',
        currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '',
        currentUser.user_metadata?.avatar_url || '',
      );
    }

    setState(prev => {
      const updatedChats = prev.chats.map(c => {
        if (c.id !== chatId) return c;
        const isFirstUserMsg = message.type === 'user' && c.title === 'New Chat';
        const newTitle = isFirstUserMsg
          ? truncate((message as { content: string }).content, 40)
          : c.title;

        if (isFirstUserMsg && user) {
          updateThreadTitle(chatId, newTitle);
        }

        return {
          ...c,
          title: newTitle,
          messages: [...c.messages, message],
        };
      });

      // If chatId doesn't exist yet (new chat with first message scenario)
      const exists = updatedChats.some(c => c.id === chatId);
      if (!exists) {
        const newChat: Chat = {
          id: chatId,
          title: message.type === 'user' ? truncate((message as { content: string }).content, 40) : 'New Chat',
          messages: [welcomeMessage(), message],
          createdAt: now(),
        };
        return { ...prev, chats: [newChat, ...prev.chats], activeChatId: chatId };
      }

      return { ...prev, chats: updatedChats };
    });

    // Persist to backend
    if (user) {
      await persistMessage(user.id, chatId, message);
    }
  }, [user, persistMessage, updateThreadTitle]);

  const updateMessage = useCallback((chatId: string, messageId: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId
          ? {
            ...c,
            messages: c.messages.map(m =>
              m.id === messageId ? { ...m, ...updates } as Message : m
            ),
          }
          : c
      ),
    }));

    // Persist update
    if (user) {
      updatePersistedMessage(messageId, updates);
    }
  }, [user, updatePersistedMessage]);

  // ── sendPrompt ────────────────────────────────────────────────────────────

  const sendPrompt = useCallback(async (prompt: string) => {
    // If no active chat, create one first
    let chatId = state.activeChatId;
    if (!chatId) {
      chatId = await addChat();
    }

    const userMsg: Message = {
      id: generateId(),
      type: 'user',
      content: prompt,
      timestamp: now(),
    };
    await addMessage(chatId, userMsg);
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const modelIds = state.availableModels.map(m => m.id);

      if (modelIds.length === 0) {
        const errMsg: Message = {
          id: generateId(),
          type: 'error',
          content: 'No models available. Please connect at least one API key in Settings.',
          timestamp: now(),
        };
        await addMessage(chatId, errMsg);
        return;
      }

      const plan = await api.generatePlan(
        prompt,
        modelIds,
        state.sessionId,
        state.conversationHistory,
        state.sharedContext,
      );
      const planMsg: Message = {
        id: generateId(),
        type: 'plan',
        plan,
        timestamp: now(),
      };
      await addMessage(chatId, planMsg);
    } catch (err) {
      const errMsg: Message = {
        id: generateId(),
        type: 'error',
        content: err instanceof Error ? err.message : 'Failed to generate plan',
        timestamp: now(),
      };
      await addMessage(chatId, errMsg);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.activeChatId, state.availableModels, state.sessionId, state.conversationHistory, state.sharedContext, addMessage, addChat]);

  // ── approvePlan ───────────────────────────────────────────────────────────

  const approvePlan = useCallback(async (chatId: string, _messageId: string, plan: Plan) => {
    setState(prev => ({ ...prev, isExecuting: true }));

    const wave0Ids = plan.subtasks
      .filter(t => !t.dependsOn || t.dependsOn.length === 0)
      .map(t => t.id);

    const execMsgId = generateId();
    const execMsg: Message = {
      id: execMsgId,
      type: 'executing',
      plan,
      completedSubtasks: [],
      runningSubtasks: wave0Ids,
      failedSubtasks: [],
      timestamp: now(),
    };
    await addMessage(chatId, execMsg);

    try {
      const result = await api.executePlan(plan, state.sessionId);

      const summary = truncate(result.finalOutput || 'Execution completed', 200);
      setState(prev => ({
        ...prev,
        conversationHistory: [
          ...prev.conversationHistory,
          { prompt: plan.prompt, resultSummary: summary },
        ].slice(-5),
      }));

      updateMessage(chatId, execMsgId, {
        type: 'result',
        result,
        plan,
        timestamp: now(),
      } as Partial<Message>);
    } catch (err) {
      updateMessage(chatId, execMsgId, {
        type: 'error',
        content: err instanceof Error ? err.message : 'Execution failed',
        timestamp: now(),
      } as Partial<Message>);
    } finally {
      setState(prev => ({ ...prev, isExecuting: false }));
    }
  }, [state.sessionId, addMessage, updateMessage]);

  // ── cancelPlan ────────────────────────────────────────────────────────────

  const cancelPlan = useCallback((chatId: string, messageId: string) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId
          ? { ...c, messages: c.messages.filter(m => m.id !== messageId) }
          : c
      ),
    }));
  }, []);

  // ── provider / model ops ──────────────────────────────────────────────────

  const connectProvider = useCallback(async (provider: string, apiKey: string) => {
    const result = await api.submitKey(provider, apiKey, state.sessionId);
    setState(prev => ({
      ...prev,
      connectedProviders: [
        ...prev.connectedProviders.filter(p => p.provider !== provider),
        { ...result, provider: provider as ConnectedProvider['provider'] },
      ],
    }));
    const models = await api.getModels(state.sessionId);
    setState(prev => ({ ...prev, availableModels: models }));
    return result;
  }, [state.sessionId]);

  const refreshModels = useCallback(async () => {
    const models = await api.getModels(state.sessionId);
    const providers = Array.from(new Set(models.map(m => m.provider))).map(p => ({
      provider: p as ConnectedProvider['provider'],
      status: 'active' as const,
      hint: 'Loaded from backend',
      validated_at: new Date().toISOString(),
    }));
    setState(prev => ({ ...prev, availableModels: models, connectedProviders: providers }));
  }, [state.sessionId]);

  const checkBackend = useCallback(async () => {
    const online = await api.healthCheck();
    setState(prev => ({ ...prev, backendOnline: online }));
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    persistedMsgIds.current.clear();
    lastInitializedUserId.current = null;
    setUser(null);
    setState(prev => ({
      ...prev,
      sessionId: '',
      connectedProviders: [],
      availableModels: [],
      chats: [],
      activeChatId: null,
    }));
  }, []);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <ChatContext.Provider value={{
      ...state,
      user,
      isLoadingChats,
      addChat,
      setActiveChat,
      deleteChat,
      addMessage,
      updateMessage,
      sendPrompt,
      approvePlan,
      connectProvider,
      refreshModels,
      checkBackend,
      logout,
      cancelPlan,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
