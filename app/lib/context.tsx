'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppState, Chat, Message, ConnectedProvider, Plan, ConversationHistoryEntry } from './types';
import { generateId, now, truncate, getSessionId } from './utils';
import { createClient } from './supabase';
import * as api from './api';
import type { User } from '@supabase/supabase-js';

interface ChatContextType extends AppState {
  user: User | null;
  addChat: () => string;
  setActiveChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (chatId: string, message: Message) => void;
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

export function ChatProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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

  const initializeForUser = useCallback((userId: string) => {
    const initialChatId = generateId();
    setState(prev => ({
      ...prev,
      sessionId: userId,
      chats: prev.chats.length > 0 ? prev.chats : [{
        id: initialChatId,
        title: 'New Chat',
        messages: [{
          id: generateId(),
          type: 'system',
          content: 'Welcome to Cortex Flow. Describe your task and I\'ll route it to the best AI models.',
          timestamp: now(),
        }],
        createdAt: now(),
      }],
      activeChatId: prev.activeChatId || initialChatId,
    }));

    // Check backend and load models
    api.healthCheck().then(online => {
      setState(prev => ({ ...prev, backendOnline: online }));
      if (online) {
        api.getModels(userId).then(models => {
          const providers = Array.from(new Set(models.map(m => m.provider))).map(p => ({
            provider: p as ConnectedProvider['provider'],
            status: 'active' as const,
            hint: 'Loaded from backend',
            validated_at: new Date().toISOString()
          }));
          setState(prev => ({ ...prev, availableModels: models, connectedProviders: providers }));
        });
      }
    });
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        initializeForUser(user.id);
      } else {
        initializeForUser(getSessionId());
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        initializeForUser(currentUser.id);
      } else {
        initializeForUser(getSessionId());
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeForUser]);

  const addChat = useCallback(() => {
    const newId = generateId();
    const newChat: Chat = {
      id: newId,
      title: 'New Chat',
      messages: [{
        id: generateId(),
        type: 'system',
        content: 'Welcome to Cortex Flow. Describe your task and I\'ll route it to the best AI models.',
        timestamp: now(),
      }],
      createdAt: now(),
    };
    setState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      activeChatId: newId,
    }));
    return newId;
  }, []);

  const setActiveChat = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeChatId: id }));
  }, []);

  const deleteChat = useCallback((id: string) => {
    setState(prev => {
      const filtered = prev.chats.filter(c => c.id !== id);
      let newActiveId = prev.activeChatId;
      if (prev.activeChatId === id) {
        newActiveId = filtered[0]?.id || null;
      }
      return { ...prev, chats: filtered, activeChatId: newActiveId };
    });
  }, []);

  const addMessage = useCallback((chatId: string, message: Message) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId
          ? {
              ...c,
              messages: [...c.messages, message],
              title: c.title === 'New Chat' && message.type === 'user'
                ? truncate(message.content, 40)
                : c.title,
            }
          : c
      ),
    }));
  }, []);

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
  }, []);

  const sendPrompt = useCallback(async (prompt: string) => {
    const chatId = state.activeChatId;
    if (!chatId) return;

    const userMsg: Message = {
      id: generateId(),
      type: 'user',
      content: prompt,
      timestamp: now(),
    };
    addMessage(chatId, userMsg);
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
        addMessage(chatId, errMsg);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const plan = await api.generatePlan(
        prompt,
        modelIds,
        state.sessionId,
        state.conversationHistory,
        state.sharedContext
      );
      const planMsg: Message = {
        id: generateId(),
        type: 'plan',
        plan,
        timestamp: now(),
      };
      addMessage(chatId, planMsg);
    } catch (err) {
      const errMsg: Message = {
        id: generateId(),
        type: 'error',
        content: err instanceof Error ? err.message : 'Failed to generate plan',
        timestamp: now(),
      };
      addMessage(chatId, errMsg);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.activeChatId, state.availableModels, state.sessionId, state.conversationHistory, state.sharedContext, addMessage]);

  const approvePlan = useCallback(async (chatId: string, _messageId: string, plan: Plan) => {
    setState(prev => ({ ...prev, isExecuting: true }));

    // Collect all subtask IDs in wave 0 as initially running (concurrent within wave)
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
    addMessage(chatId, execMsg);

    try {
      const result = await api.executePlan(plan, state.sessionId);

      // Append to conversation history (capped at 5 client-side)
      const summary = truncate(result.finalOutput || 'Execution completed', 200);
      const historyEntry: ConversationHistoryEntry = {
        prompt: plan.prompt,
        resultSummary: summary,
      };
      setState(prev => ({
        ...prev,
        conversationHistory: [...prev.conversationHistory, historyEntry].slice(-5),
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

  const cancelPlan = useCallback((chatId: string, messageId: string) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.filter(m => m.id !== messageId),
            }
          : c
      ),
    }));
  }, []);

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
      validated_at: new Date().toISOString()
    }));
    setState(prev => ({ ...prev, availableModels: models, connectedProviders: providers }));
  }, [state.sessionId]);

  const checkBackend = useCallback(async () => {
    const online = await api.healthCheck();
    setState(prev => ({ ...prev, backendOnline: online }));
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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

  return (
    <ChatContext.Provider value={{
      ...state,
      user,
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
