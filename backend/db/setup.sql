-- ============================================
-- Cortex Flow: Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. API Key Vault — stores user API keys for LLM providers
CREATE TABLE IF NOT EXISTS api_key_vault (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google_gemini')),
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  is_valid BOOLEAN DEFAULT false,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by session + provider
CREATE INDEX IF NOT EXISTS idx_vault_session_provider 
  ON api_key_vault(session_id, provider);

-- 2. Model Registry — catalog of available LLM models
CREATE TABLE IF NOT EXISTS model_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  strengths TEXT[] DEFAULT '{}',
  context_window INTEGER DEFAULT 4096,
  cost_per_1k_input NUMERIC(10, 6) DEFAULT 0,
  cost_per_1k_output NUMERIC(10, 6) DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 1000,
  supports_streaming BOOLEAN DEFAULT true,
  supports_json_mode BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seed model registry with popular models
INSERT INTO model_registry (model_id, provider, display_name, strengths, context_window, cost_per_1k_input, cost_per_1k_output, avg_latency_ms, supports_streaming, supports_json_mode) VALUES
  -- OpenAI
  ('gpt-4o', 'openai', 'GPT-4o', ARRAY['reasoning', 'coding', 'analysis', 'multimodal'], 128000, 0.005, 0.015, 800, true, true),
  ('gpt-4o-mini', 'openai', 'GPT-4o Mini', ARRAY['fast', 'coding', 'general'], 128000, 0.00015, 0.0006, 400, true, true),
  ('gpt-4.1', 'openai', 'GPT-4.1', ARRAY['reasoning', 'analysis', 'coding'], 128000, 0.01, 0.03, 1000, true, true),
  -- Anthropic
  ('claude-sonnet-4-20250514', 'anthropic', 'Claude 4 Sonnet', ARRAY['coding', 'analysis', 'writing', 'reasoning'], 200000, 0.003, 0.015, 600, true, true),
  ('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', ARRAY['fast', 'general', 'summarization'], 200000, 0.0008, 0.004, 300, true, true),
  ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', ARRAY['coding', 'analysis', 'writing', 'reasoning'], 200000, 0.003, 0.015, 600, true, true),
  -- Google Gemini
  ('gemini-2.5-pro', 'google_gemini', 'Gemini 2.5 Pro', ARRAY['reasoning', 'multimodal', 'long-context', 'coding'], 1048576, 0.00125, 0.01, 800, true, true),
  ('gemini-2.5-flash', 'google_gemini', 'Gemini 2.5 Flash', ARRAY['fast', 'reasoning', 'multimodal', 'coding'], 1048576, 0.000075, 0.0003, 150, true, true),
  ('gemini-2.0-flash', 'google_gemini', 'Gemini 2.0 Flash', ARRAY['fast', 'general', 'multimodal'], 1048576, 0.0001, 0.0004, 200, true, true)
ON CONFLICT (model_id) DO NOTHING;

-- 4. Executions — analytics/audit log for each approved plan execution
CREATE TABLE IF NOT EXISTS executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT,
  difficulty TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  models_used TEXT[] DEFAULT '{}',
  total_tokens INTEGER DEFAULT 0,
  total_cost NUMERIC(10, 6) DEFAULT 0,
  total_time_ms INTEGER DEFAULT 0,
  fallback_events JSONB DEFAULT '[]'::jsonb,
  confidence_scores JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_session_created
  ON executions(session_id, created_at DESC);

-- 5. Session Context — stores facts and decisions worth remembering across turns
CREATE TABLE IF NOT EXISTS session_context (
  session_id TEXT PRIMARY KEY,
  context JSONB NOT NULL DEFAULT '{"facts":[],"decisions":[]}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Users — public profile rows used by chat persistence FKs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- 7. Chat Threads — durable conversations shown in the sidebar
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_updated
  ON chat_threads(user_id, updated_at DESC);

-- 8. Chat Messages — exact user/model messages for each thread
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('user', 'plan', 'executing', 'result', 'error', 'system')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages(user_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON chat_messages(thread_id, created_at ASC);
