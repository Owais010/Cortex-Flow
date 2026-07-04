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

function rowToMessage(row: { id: string; type: string; content: unknown; created_at: string }): Message {
  const payload = row.content as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as Message['type'],
    timestamp: row.created_at,
    ...payload,
  } as Message;
}

function messageToContent(msg: Message): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, type: _type, timestamp: _ts, ...rest } = msg as Record<string, unknown>;
  return rest;
}

function welcomeMessage(): Message {
  return {
    id: generateId(),
    type: 'system',
    content: "Welcome to Cortex Flow. Describe your task and I'll route it to the best AI models.",
    timestamp: now(),
  } as Message;
}

// ─── context type ────────────────────────────────────────────────────────────

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

// ─── provider ────────────────────────────────────────────────────────────────

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

  // stateRef lets callbacks read the latest state without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track persisted message IDs to skip duplicate INSERTs
  const persistedMsgIds = useRef<Set<string>>(new Set());
  const lastInitUserId = useRef<string | null>(null);

  // ── Supabase helpers ──────────────────────────────────────────────────────

  const supabaseLoadChats = useCallback(async (userId: string): Promise<Chat[] | null> => {
    const supabase = createClient();
    setIsLoadingChats(true);
    try {
      const { data: threads, error: tErr } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (tErr || !threads || threads.length === 0) return null;

      const { data: msgs, error: mErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (mErr) return null;

      (msgs ?? []).forEach(r => persistedMsgIds.current.add(r.id));

      const msgsByThread: Record<string, Message[]> = {};
      for (const row of msgs ?? []) {
        if (!msgsByThread[row.thread_id]) msgsByThread[row.thread_id] = [];
        msgsByThread[row.thread_id].push(rowToMessage(row));
      }

      return threads.map(t => ({
        id: t.id,
        title: t.title,
        createdAt: t.created_at,
        messages: [welcomeMessage(), ...(msgsByThread[t.id] ?? [])],
      }));
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  const supabaseCreateThread = useCallback(async (userId: string, threadId: string, title: string) => {
    const supabase = createClient();
    await supabase.from('chat_threads').upsert({
      id: threadId,
      user_id: userId,
      title,
      created_at: now(),
      updated_at: now(),
    }, { onConflict: 'id' });
  }, []);

  const supabaseUpdateThreadTitle = useCallback(async (threadId: string, title: string) => {
    const supabase = createClient();
    await supabase
      .from('chat_threads')
      .update({ title, updated_at: now() })
      .eq('id', threadId);
  }, []);

  const supabaseDeleteThread = useCallback(async (threadId: string) => {
    const supabase = createClient();
    // cascade via FK deletes messages automatically
    await supabase.from('chat_threads').delete().eq('id', threadId);
  }, []);

  const supabaseSaveMessage = useCallback(async (userId: string, threadId: string, msg: Message) => {
    if (msg.type === 'system') return; // never persist welcome messages
    const supabase = createClient();
    const { error } = await supabase.from('chat_messages').upsert({
      id: msg.id,
      thread_id: threadId,
      user_id: userId,
      type: msg.type,
      content: messageToContent(msg),
      created_at: msg.timestamp,
    }, { onConflict: 'id' });
    if (!error) persistedMsgIds.current.add(msg.id);
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────

  const initializeForUser = useCallback(async (userId: string, isAuthUser: boolean) => {
    if (lastInitUserId.current === userId) return;
    lastInitUserId.current = userId;

    setState(prev => ({ ...prev, sessionId: userId }));

    if (isAuthUser) {
      const persisted = await supabaseLoadChats(userId);
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
        setState(prev => ({ ...prev, sessionId: userId, chats: [], activeChatId: null }));
      }
    } else {
      // Guest: local only
      let localChats: Chat[] = [];
      try {
        const stored = typeof window !== 'undefined' && localStorage.getItem('cortex_flow_guest_chats');
        if (stored) localChats = JSON.parse(stored);
      } catch { /* ignore */ }
      setState(prev => ({
        ...prev,
        sessionId: userId,
        chats: localChats.length > 0 ? localChats : prev.chats,
        activeChatId: prev.activeChatId || localChats[0]?.id || null,
      }));
    }

    // Backend health + models (fire-and-forget)
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
  }, [supabaseLoadChats]);

  // Auth listener
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      initializeForUser(u ? u.id : getSessionId(), !!u);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      initializeForUser(u ? u.id : getSessionId(), !!u);
    });
    return () => subscription.unsubscribe();
  }, [initializeForUser]);

  // Persist guest chats to localStorage
  useEffect(() => {
    if (!user && state.sessionId) {
      try { localStorage.setItem('cortex_flow_guest_chats', JSON.stringify(state.chats)); } catch { /* ignore */ }
    }
  }, [state.chats, user, state.sessionId]);

  // ── Chat CRUD ─────────────────────────────────────────────────────────────

  const addChat = useCallback(async (): Promise<string> => {
    const newId = generateId();
    if (user) await supabaseCreateThread(user.id, newId, 'New Chat');
    const newChat: Chat = {
      id: newId,
      title: 'New Chat',
      messages: [welcomeMessage()],
      createdAt: now(),
    };
    setState(prev => ({ ...prev, chats: [newChat, ...prev.chats], activeChatId: newId }));
    return newId;
  }, [user, supabaseCreateThread]);

  const setActiveChat = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeChatId: id }));
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    if (user) await supabaseDeleteThread(id);
    setState(prev => {
      const filtered = prev.chats.filter(c => c.id !== id);
      return {
        ...prev,
        chats: filtered,
        activeChatId: prev.activeChatId === id ? (filtered[0]?.id ?? null) : prev.activeChatId,
      };
    });
  }, [user, supabaseDeleteThread]);

  // ── Message ops ───────────────────────────────────────────────────────────

  const addMessage = useCallback(async (chatId: string, message: Message) => {
    // Ensure the thread row exists before inserting the message (avoids FK violation)
    if (user && message.type === 'user') {
      const title = truncate((message as { content: string }).content, 40);
      await supabaseCreateThread(user.id, chatId, title);
    }

    setState(prev => {
      const updatedChats = prev.chats.map(c => {
        if (c.id !== chatId) return c;
        const isFirstUser = message.type === 'user' && c.title === 'New Chat';
        const newTitle = isFirstUser
          ? truncate((message as { content: string }).content, 40)
          : c.title;
        if (isFirstUser && user) supabaseUpdateThreadTitle(chatId, newTitle);
        return { ...c, title: newTitle, messages: [...c.messages, message] };
      });

      if (!updatedChats.some(c => c.id === chatId)) {
        const title = message.type === 'user'
          ? truncate((message as { content: string }).content, 40)
          : 'New Chat';
        const newChat: Chat = {
          id: chatId,
          title,
          messages: [welcomeMessage(), message],
          createdAt: now(),
        };
        return { ...prev, chats: [newChat, ...prev.chats], activeChatId: chatId };
      }
      return { ...prev, chats: updatedChats };
    });

    if (user) await supabaseSaveMessage(user.id, chatId, message);
  }, [user, supabaseCreateThread, supabaseUpdateThreadTitle, supabaseSaveMessage]);

  const updateMessage = useCallback((chatId: string, messageId: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId
          ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } as Message : m) }
          : c
      ),
    }));

    // Persist the fully-merged message so 'executing' → 'result' transitions are saved
    if (user) {
      const chat = stateRef.current.chats.find(c => c.id === chatId);
      const old = chat?.messages.find(m => m.id === messageId);
      if (old) supabaseSaveMessage(user.id, chatId, { ...old, ...updates } as Message);
    }
  }, [user, supabaseSaveMessage]);

  // ── sendPrompt ────────────────────────────────────────────────────────────

  const sendPrompt = useCallback(async (prompt: string) => {
    let chatId = state.activeChatId;
    if (!chatId) chatId = await addChat();

    const userMsg: Message = { id: generateId(), type: 'user', content: prompt, timestamp: now() };
    await addMessage(chatId, userMsg);
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const modelIds = state.availableModels.map(m => m.id);
      if (modelIds.length === 0) {
        await addMessage(chatId, {
          id: generateId(), type: 'error',
          content: 'No models available. Please connect at least one API key in Settings.',
          timestamp: now(),
        });
        return;
      }

      const plan = await api.generatePlan(
        prompt, modelIds, state.sessionId, state.conversationHistory, state.sharedContext,
      );
      await addMessage(chatId, { id: generateId(), type: 'plan', plan, timestamp: now() });
    } catch (err) {
      await addMessage(chatId, {
        id: generateId(), type: 'error',
        content: err instanceof Error ? err.message : 'Failed to generate plan',
        timestamp: now(),
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.activeChatId, state.availableModels, state.sessionId, state.conversationHistory, state.sharedContext, addMessage, addChat]);

  // ── approvePlan ───────────────────────────────────────────────────────────

  const approvePlan = useCallback(async (chatId: string, _messageId: string, plan: Plan) => {
    setState(prev => ({ ...prev, isExecuting: true }));

    const wave0Ids = plan.subtasks.filter(t => !t.dependsOn || t.dependsOn.length === 0).map(t => t.id);
    const execMsgId = generateId();
    const execMsg: Message = {
      id: execMsgId, type: 'executing', plan,
      completedSubtasks: [], runningSubtasks: wave0Ids, failedSubtasks: [],
      timestamp: now(),
    };
    await addMessage(chatId, execMsg);

    try {
      const result = await api.executePlan(plan, state.sessionId);
      setState(prev => ({
        ...prev,
        conversationHistory: [
          ...prev.conversationHistory,
          { prompt: plan.prompt, resultSummary: truncate(result.finalOutput || 'Execution completed', 200) },
        ].slice(-5),
      }));
      updateMessage(chatId, execMsgId, { type: 'result', result, plan, timestamp: now() } as Partial<Message>);
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
        c.id === chatId ? { ...c, messages: c.messages.filter(m => m.id !== messageId) } : c
      ),
    }));
  }, []);

  // ── provider / models ─────────────────────────────────────────────────────

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
    lastInitUserId.current = null;
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
