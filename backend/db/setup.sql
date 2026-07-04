-- ============================================
-- Agent Ascend: Database Setup
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
  ('gpt-4-turbo', 'openai', 'GPT-4 Turbo', ARRAY['reasoning', 'analysis', 'coding'], 128000, 0.01, 0.03, 1200, true, true),
  -- Anthropic
  ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', ARRAY['coding', 'analysis', 'writing', 'reasoning'], 200000, 0.003, 0.015, 600, true, true),
  ('claude-3-haiku-20240307', 'anthropic', 'Claude 3 Haiku', ARRAY['fast', 'general', 'summarization'], 200000, 0.00025, 0.00125, 300, true, true),
  ('claude-3-opus-20240229', 'anthropic', 'Claude 3 Opus', ARRAY['complex-reasoning', 'research', 'analysis'], 200000, 0.015, 0.075, 2000, true, true),
  -- Google Gemini
  ('gemini-1.5-pro', 'google_gemini', 'Gemini 1.5 Pro', ARRAY['reasoning', 'multimodal', 'long-context'], 2097152, 0.00125, 0.005, 900, true, true),
  ('gemini-1.5-flash', 'google_gemini', 'Gemini 1.5 Flash', ARRAY['fast', 'general', 'multimodal'], 1048576, 0.000075, 0.0003, 250, true, true),
  ('gemini-2.0-flash', 'google_gemini', 'Gemini 2.0 Flash', ARRAY['fast', 'reasoning', 'multimodal', 'coding'], 1048576, 0.0001, 0.0004, 200, true, true)
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
