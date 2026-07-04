# Database Schema

**Project:** BYO-LLM Orchestrator  
**Database:** PostgreSQL (Supabase)  
**Last Updated:** 2026-05-09

---

## Overview

This schema defines the database structure for the BYO-LLM Orchestrator platform. The system enables users to bring their own LLM API keys, orchestrate complex AI workflows, and track usage across multiple providers.

**Key Features:**
- Secure API key vault with encryption
- Session-based authentication (MVP)
- Multi-provider model registry
- Execution tracking and subtask management
- Comprehensive audit logging
- Usage analytics and cost tracking

---

## Tables

### 1. `users`

User accounts and subscription management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user identifier |
| `email` | varchar | UNIQUE, NOT NULL | User email address |
| `display_name` | varchar | - | User display name |
| `avatar_url` | text | - | Profile avatar URL |
| `plan` | user_plan_enum | DEFAULT 'free' | Subscription plan (free, pro, enterprise) |
| `is_active` | boolean | DEFAULT true | Account status |
| `daily_spend_cap_usd` | numeric | DEFAULT 10.00 | Daily spending limit |
| `last_login_at` | timestamptz | - | Last login timestamp |
| `deleted_at` | timestamptz | - | Soft delete timestamp |
| `created_at` | timestamptz | DEFAULT now() | Account creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Foreign Keys:** None

**Indexes:**
- `users_email_key` (UNIQUE on email)

---

### 2. `sessions`

Session management for authentication (MVP: session-based).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique session identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | Associated user |
| `token_hash` | varchar | UNIQUE, NOT NULL | Hashed session token |
| `ip_address` | inet | - | Client IP address |
| `user_agent` | text | - | Client user agent |
| `expires_at` | timestamptz | NOT NULL | Session expiration |
| `revoked_at` | timestamptz | - | Session revocation timestamp |
| `created_at` | timestamptz | DEFAULT now() | Session creation time |

**Foreign Keys:**
- `sessions_user_id_fkey` → `users(id)`

**Indexes:**
- `sessions_token_hash_key` (UNIQUE on token_hash)

**Security Note:** MVP uses session-based auth with UUID stored in localStorage. Production should implement proper JWT tokens.

---

### 3. `api_key_vault`

Secure storage for user-provided LLM API keys.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique key identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | Key owner |
| `provider` | provider_enum | NOT NULL | LLM provider (openai, anthropic, google_gemini) |
| `encrypted_key` | text | NOT NULL | AES-256-GCM encrypted key |
| `iv` | varchar | NOT NULL | Initialization vector |
| `auth_tag` | varchar | NOT NULL | Authentication tag |
| `key_hint` | varchar | - | Last 4 characters for UI display |
| `is_valid` | boolean | DEFAULT false | Key validation status |
| `last_validated_at` | timestamptz | - | Last validation timestamp |
| `validation_error` | text | - | Validation error message |
| `rotated_at` | timestamptz | - | Key rotation timestamp |
| `revoked_at` | timestamptz | - | Key revocation timestamp |
| `created_at` | timestamptz | DEFAULT now() | Key creation time |
| `session_id` | uuid | FOREIGN KEY → sessions(id) | Session for MVP auth |

**Foreign Keys:**
- `api_key_vault_user_id_fkey` → `users(id)`
- `api_key_vault_session_id_fkey` → `sessions(id)`

**Indexes:**
- `api_key_vault_session_id_idx` on `session_id`
- Unique index on `(session_id, provider)` where `revoked_at IS NULL`

**Security Rules:**
- 🔴 Keys encrypted with AES-256-GCM before storage
- 🔴 Decrypted keys live <50ms in memory
- 🔴 Never return keys in API responses
- 🔴 Only last 4 chars stored as hint
- 🔴 Row Level Security (RLS) enabled

---

### 4. `model_registry`

Registry of available LLM models across providers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique model identifier |
| `provider` | provider_enum | NOT NULL | LLM provider |
| `model_id` | varchar | UNIQUE, NOT NULL | Provider's model identifier |
| `display_name` | varchar | NOT NULL | Human-readable name |
| `strengths` | jsonb | - | Model capabilities (e.g., coding, reasoning) |
| `context_window` | integer | NOT NULL | Maximum context tokens |
| `cost_per_1k_input` | numeric | NOT NULL | Input cost per 1000 tokens |
| `cost_per_1k_output` | numeric | NOT NULL | Output cost per 1000 tokens |
| `avg_latency_ms` | integer | - | Average response latency |
| `supports_streaming` | boolean | DEFAULT true | Streaming support |
| `supports_json_mode` | boolean | DEFAULT false | JSON mode support |
| `is_active` | boolean | DEFAULT true | Model availability |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Foreign Keys:** None

**Indexes:**
- `model_registry_model_id_key` (UNIQUE on model_id)

**Sample Data:**
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo
- Anthropic: claude-3-5-sonnet-20241022, claude-3-haiku-20240307
- Google Gemini: gemini-1.5-pro, gemini-1.5-flash

---

### 5. `executions`

Main execution records for user prompts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique execution identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | Requesting user |
| `session_id` | uuid | FOREIGN KEY → sessions(id) | Session context |
| `prompt_raw` | text | NOT NULL | Original user prompt |
| `prompt_category` | prompt_category_enum | - | Prompt type (coding, debugging, etc.) |
| `difficulty` | difficulty_enum | - | Estimated difficulty |
| `status` | execution_status_enum | DEFAULT 'pending' | Execution status |
| `available_models` | jsonb | NOT NULL | Models available for this prompt |
| `router_model_id` | uuid | FOREIGN KEY → model_registry(id) | Router LLM used |
| `final_output` | text | - | Final execution result |
| `total_tokens_in` | integer | - | Total input tokens |
| `total_tokens_out` | integer | - | Total output tokens |
| `estimated_cost_usd` | numeric | - | Pre-execution cost estimate |
| `total_cost_usd` | numeric | - | Actual cost incurred |
| `latency_ms` | integer | - | Total execution latency |
| `user_approved_at` | timestamptz | - | User approval timestamp |
| `started_at` | timestamptz | - | Execution start time |
| `completed_at` | timestamptz | - | Execution completion time |
| `created_at` | timestamptz | DEFAULT now() | Record creation time |

**Foreign Keys:**
- `executions_user_id_fkey` → `users(id)`
- `executions_session_id_fkey` → `sessions(id)`
- `executions_router_model_id_fkey` → `model_registry(id)`

**Enums:**
- `execution_status_enum`: pending, planning, approved, executing, completed, failed, cancelled

---

### 6. `execution_plans`

Generated execution plans for complex prompts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique plan identifier |
| `execution_id` | uuid | FOREIGN KEY → executions(id) | Parent execution |
| `version` | smallint | DEFAULT 1 | Plan version |
| `plan_json` | jsonb | NOT NULL | Plan structure (subtasks, dependencies) |
| `is_approved` | boolean | DEFAULT false | User approval status |
| `approved_by` | uuid | FOREIGN KEY → users(id) | Approving user |
| `approved_at` | timestamptz | - | Approval timestamp |
| `created_at` | timestamptz | DEFAULT now() | Plan creation time |

**Foreign Keys:**
- `execution_plans_execution_id_fkey` → `executions(id)`
- `execution_plans_approved_by_fkey` → `users(id)`

**Plan JSON Structure:**
```json
{
  "subtasks": [
    {
      "sequence_order": 1,
      "title": "Analyze codebase structure",
      "prompt_fragment": "Examine the project structure...",
      "assigned_model": "gpt-4o",
      "dependencies": []
    }
  ],
  "estimated_tokens_in": 5000,
  "estimated_tokens_out": 3000,
  "estimated_cost_usd": 0.15
}
```

---

### 7. `subtasks`

Individual steps within an execution plan.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique subtask identifier |
| `execution_id` | uuid | FOREIGN KEY → executions(id) | Parent execution |
| `plan_id` | uuid | FOREIGN KEY → execution_plans(id) | Parent plan |
| `sequence_order` | smallint | NOT NULL | Execution order |
| `title` | varchar | NOT NULL | Subtask title |
| `prompt_fragment` | text | NOT NULL | Prompt for this subtask |
| `assigned_model_id` | uuid | FOREIGN KEY → model_registry(id) | Assigned model |
| `fallback_model_id` | uuid | FOREIGN KEY → model_registry(id) | Fallback model |
| `model_used_id` | uuid | FOREIGN KEY → model_registry(id) | Actual model used |
| `status` | subtask_status_enum | DEFAULT 'pending' | Subtask status |
| `output` | text | - | Subtask output |
| `tokens_in` | integer | - | Input tokens used |
| `tokens_out` | integer | - | Output tokens generated |
| `cost_usd` | numeric | - | Cost incurred |
| `latency_ms` | integer | - | Execution latency |
| `fallback_triggered` | boolean | DEFAULT false | Fallback activated |
| `error_message` | text | - | Error details |
| `started_at` | timestamptz | - | Start time |
| `completed_at` | timestamptz | - | Completion time |

**Foreign Keys:**
- `subtasks_execution_id_fkey` → `executions(id)`
- `subtasks_plan_id_fkey` → `execution_plans(id)`
- `subtasks_assigned_model_id_fkey` → `model_registry(id)`
- `subtasks_fallback_model_id_fkey` → `model_registry(id)`
- `subtasks_model_used_id_fkey` → `model_registry(id)`

**Enums:**
- `subtask_status_enum`: pending, in_progress, completed, failed, cancelled

---

### 8. `confidence_scores`

Quality scoring for subtask outputs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique score identifier |
| `subtask_id` | uuid | FOREIGN KEY → subtasks(id) | Related subtask |
| `execution_id` | uuid | FOREIGN KEY → executions(id) | Parent execution |
| `scorer_model_id` | uuid | FOREIGN KEY → model_registry(id) | Model used for scoring |
| `score` | smallint | CHECK (0-100) | Confidence score (0-100) |
| `note` | text | - | Scoring notes |
| `raw_response` | jsonb | - | Full scorer response |
| `scorer_cost_usd` | numeric | - | Cost of scoring |
| `created_at` | timestamptz | DEFAULT now() | Score creation time |

**Foreign Keys:**
- `confidence_scores_subtask_id_fkey` → `subtasks(id)`
- `confidence_scores_execution_id_fkey` → `executions(id)`
- `confidence_scores_scorer_model_id_fkey` → `model_registry(id)`

**Scoring Logic:**
- Score ≥ 80: High confidence, proceed
- Score 50-79: Medium confidence, may need review
- Score < 50: Low confidence, trigger fallback or retry

---

### 9. `model_usage_stats`

Aggregated usage statistics per model.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique stat identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | User context |
| `model_id` | uuid | FOREIGN KEY → model_registry(id) | Model tracked |
| `period_date` | date | NOT NULL | Aggregation period |
| `call_count` | integer | DEFAULT 0 | Number of calls |
| `total_tokens_in` | bigint | DEFAULT 0 | Total input tokens |
| `total_tokens_out` | bigint | DEFAULT 0 | Total output tokens |
| `total_cost_usd` | numeric | DEFAULT 0 | Total cost |
| `avg_latency_ms` | integer | - | Average latency |
| `fallback_count` | integer | DEFAULT 0 | Fallback activations |
| `avg_confidence_score` | numeric | - | Average confidence |

**Foreign Keys:**
- `model_usage_stats_user_id_fkey` → `users(id)`
- `model_usage_stats_model_id_fkey` → `model_registry(id)`

**Aggregation:**
- Daily rollups for analytics
- Supports cost tracking and spend caps
- Enables model performance comparison

---

### 10. `audit_logs`

Comprehensive audit trail for security and compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PRIMARY KEY, AUTO INCREMENT | Unique log identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | Acting user |
| `action` | varchar | NOT NULL | Action performed |
| `resource_type` | varchar | - | Resource type (api_key, execution, etc.) |
| `resource_id` | uuid | - | Resource identifier |
| `ip_address` | inet | - | Client IP |
| `metadata` | jsonb | - | Additional context |
| `created_at` | timestamptz | DEFAULT now() | Log timestamp |

**Foreign Keys:**
- `audit_logs_user_id_fkey` → `users(id)`

**Actions Logged:**
- `api_key_submitted`
- `api_key_validated`
- `api_key_revoked`
- `execution_created`
- `execution_completed`
- `plan_approved`
- `subtask_executed`
- `fallback_triggered`

---

### 11. `prompt_templates`

Reusable prompt templates for common workflows.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique template identifier |
| `user_id` | uuid | FOREIGN KEY → users(id) | Template owner |
| `name` | varchar | NOT NULL | Template name |
| `category` | prompt_category_enum | - | Template category |
| `template_body` | text | NOT NULL | Template content |
| `variables` | jsonb | - | Variable definitions |
| `is_public` | boolean | DEFAULT false | Public visibility |
| `usage_count` | integer | DEFAULT 0 | Usage counter |
| `created_at` | timestamptz | DEFAULT now() | Creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Foreign Keys:**
- `prompt_templates_user_id_fkey` → `users(id)`

**Template Variables:**
```json
{
  "variables": {
    "codebase_path": {
      "type": "string",
      "description": "Path to analyze",
      "required": true
    },
    "focus_area": {
      "type": "string",
      "description": "Specific area to focus on",
      "required": false
    }
  }
}
```

---

## Enum Types

### `provider_enum`
- `openai`
- `anthropic`
- `google_gemini`

### `prompt_category_enum`
- `coding`
- `debugging`
- `architecture`
- `documentation`
- `testing`
- `refactoring`
- `general`

### `difficulty_enum`
- `easy`
- `medium`
- `hard`
- `expert`

### `execution_status_enum`
- `pending`
- `planning`
- `approved`
- `executing`
- `completed`
- `failed`
- `cancelled`

### `subtask_status_enum`
- `pending`
- `in_progress`
- `completed`
- `failed`
- `cancelled`

### `user_plan_enum`
- `free`
- `pro`
- `enterprise`

---

## Row Level Security (RLS)

**Security Policy:**
- 🔴 All tables have RLS enabled
- 🔴 Users can only access their own data
- 🔴 Service key bypass for admin operations

**Sample RLS Policies:**

```sql
-- api_key_vault
CREATE POLICY "Users can view their own keys"
  ON api_key_vault FOR SELECT
  USING (user_id = auth.uid() OR session_id IN (
    SELECT id FROM sessions WHERE user_id = auth.uid()
  ));

-- executions
CREATE POLICY "Users can view their own executions"
  ON executions FOR SELECT
  USING (user_id = auth.uid());

-- audit_logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());
```

---

## Indexes

### Performance Indexes

```sql
-- api_key_vault
CREATE INDEX api_key_vault_session_id_idx ON api_key_vault(session_id);
CREATE UNIQUE INDEX api_key_vault_unique_active_key 
  ON api_key_vault(session_id, provider) 
  WHERE revoked_at IS NULL;

-- executions
CREATE INDEX executions_user_id_idx ON executions(user_id);
CREATE INDEX executions_session_id_idx ON executions(session_id);
CREATE INDEX executions_status_idx ON executions(status);
CREATE INDEX executions_created_at_idx ON executions(created_at DESC);

-- subtasks
CREATE INDEX subtasks_execution_id_idx ON subtasks(execution_id);
CREATE INDEX subtasks_status_idx ON subtasks(status);

-- model_usage_stats
CREATE INDEX model_usage_stats_user_id_idx ON model_usage_stats(user_id);
CREATE INDEX model_usage_stats_model_id_idx ON model_usage_stats(model_id);
CREATE INDEX model_usage_stats_period_date_idx ON model_usage_stats(period_date DESC);

-- audit_logs
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);
```

---

## Data Flow

### 1. User Submits Prompt
1. User submits prompt via frontend
2. `executions` record created (status: pending)
3. Router LLM generates plan → `execution_plans`
4. Plan broken into subtasks → `subtasks`

### 2. Execution Flow
1. User approves plan → `executions.status = approved`
2. Subtasks executed sequentially
3. Each subtask:
   - Decrypt API key from `api_key_vault`
   - Call LLM API
   - Store output in `subtasks.output`
   - Calculate cost and tokens
   - Score output → `confidence_scores`
4. On failure: trigger fallback model
5. Update `executions` with final stats

### 3. Analytics
1. Daily aggregation job updates `model_usage_stats`
2. Cost tracking against `users.daily_spend_cap_usd`
3. Audit trail in `audit_logs`

---

## Security Notes

### 🔴 Critical Security Rules

1. **API Key Vault**
   - Keys encrypted with AES-256-GCM
   - Never returned in API responses
   - Only last 4 chars stored as hint
   - Decrypted keys live <50ms in memory

2. **Session Management**
   - MVP: UUID stored in localStorage
   - Production: Implement JWT tokens
   - Session expiration enforced

3. **Row Level Security**
   - All tables have RLS enabled
   - Users can only access own data
   - Service key for admin operations

4. **Audit Logging**
   - All sensitive actions logged
   - IP address and user agent tracked
   - Immutable audit trail

---

## Migration Notes

**Current Schema Version:** v1.0  
**Last Migration:** Added `session_id` to `api_key_vault` for MVP auth

**Pending Migrations:**
- Add proper JWT authentication tables
- Implement rate limiting tables
- Add webhook configuration for integrations

---

## Performance Considerations

1. **Connection Pooling:** Use Supabase connection pooling
2. **Query Optimization:** Indexes on frequently queried columns
3. **Partitioning:** Consider partitioning `audit_logs` by date
4. **Caching:** Cache `model_registry` in memory
5. **Archival:** Archive old `audit_logs` to cold storage

---

## Backup Strategy

- **Daily Backups:** Supabase automated backups
- **Point-in-Time Recovery:** Enabled
- **Critical Data:** `api_key_vault` (encrypted), `executions`
- **Retention:** 30 days for audit logs, 90 days for executions

---

## Support

For questions about the schema:
- Review `Database_LLM_System_Design.md` for detailed design rationale
- Check `LLM_Database_Schema.md` for original schema documentation
- Contact backend team (M1) for implementation details



-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.api_key_vault (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  provider USER-DEFINED NOT NULL,
  encrypted_key text NOT NULL,
  iv character varying NOT NULL,
  auth_tag character varying NOT NULL,
  key_hint character varying,
  is_valid boolean DEFAULT false,
  last_validated_at timestamp with time zone,
  validation_error text,
  rotated_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  session_id uuid,
  CONSTRAINT api_key_vault_pkey PRIMARY KEY (id),
  CONSTRAINT api_key_vault_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT api_key_vault_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.audit_logs (
  id bigint NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  user_id uuid,
  action character varying NOT NULL,
  resource_type character varying,
  resource_id uuid,
  ip_address inet,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.confidence_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subtask_id uuid,
  execution_id uuid,
  scorer_model_id uuid,
  score smallint NOT NULL CHECK (score >= 0 AND score <= 100),
  note text,
  raw_response jsonb,
  scorer_cost_usd numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT confidence_scores_pkey PRIMARY KEY (id),
  CONSTRAINT confidence_scores_subtask_id_fkey FOREIGN KEY (subtask_id) REFERENCES public.subtasks(id),
  CONSTRAINT confidence_scores_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id),
  CONSTRAINT confidence_scores_scorer_model_id_fkey FOREIGN KEY (scorer_model_id) REFERENCES public.model_registry(id)
);
CREATE TABLE public.execution_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  execution_id uuid,
  version smallint NOT NULL DEFAULT 1,
  plan_json jsonb NOT NULL,
  is_approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execution_plans_pkey PRIMARY KEY (id),
  CONSTRAINT execution_plans_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id),
  CONSTRAINT execution_plans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id uuid,
  prompt_raw text NOT NULL,
  prompt_category USER-DEFINED,
  difficulty USER-DEFINED,
  status USER-DEFINED DEFAULT 'pending'::execution_status_enum,
  available_models jsonb NOT NULL,
  router_model_id uuid,
  final_output text,
  total_tokens_in integer,
  total_tokens_out integer,
  estimated_cost_usd numeric,
  total_cost_usd numeric,
  latency_ms integer,
  user_approved_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT executions_pkey PRIMARY KEY (id),
  CONSTRAINT executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT executions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT executions_router_model_id_fkey FOREIGN KEY (router_model_id) REFERENCES public.model_registry(id)
);
CREATE TABLE public.model_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider USER-DEFINED NOT NULL,
  model_id character varying NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  strengths jsonb,
  context_window integer NOT NULL,
  cost_per_1k_input numeric NOT NULL,
  cost_per_1k_output numeric NOT NULL,
  avg_latency_ms integer,
  supports_streaming boolean DEFAULT true,
  supports_json_mode boolean DEFAULT false,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT model_registry_pkey PRIMARY KEY (id)
);
CREATE TABLE public.model_usage_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  model_id uuid,
  period_date date NOT NULL,
  call_count integer DEFAULT 0,
  total_tokens_in bigint DEFAULT 0,
  total_tokens_out bigint DEFAULT 0,
  total_cost_usd numeric DEFAULT 0,
  avg_latency_ms integer,
  fallback_count integer DEFAULT 0,
  avg_confidence_score numeric,
  CONSTRAINT model_usage_stats_pkey PRIMARY KEY (id),
  CONSTRAINT model_usage_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT model_usage_stats_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model_registry(id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL,
  plan_id uuid NOT NULL,
  plan_version integer NOT NULL,
  session_id uuid NOT NULL,
  plan_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.prompt_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name character varying NOT NULL,
  category USER-DEFINED,
  template_body text NOT NULL,
  variables jsonb,
  is_public boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_templates_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  token_hash character varying NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  execution_id uuid,
  plan_id uuid,
  sequence_order smallint NOT NULL,
  title character varying NOT NULL,
  prompt_fragment text NOT NULL,
  assigned_model_id uuid,
  fallback_model_id uuid,
  model_used_id uuid,
  status USER-DEFINED DEFAULT 'pending'::subtask_status_enum,
  output text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  latency_ms integer,
  fallback_triggered boolean DEFAULT false,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT subtasks_pkey PRIMARY KEY (id),
  CONSTRAINT subtasks_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id),
  CONSTRAINT subtasks_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.execution_plans(id),
  CONSTRAINT subtasks_assigned_model_id_fkey FOREIGN KEY (assigned_model_id) REFERENCES public.model_registry(id),
  CONSTRAINT subtasks_fallback_model_id_fkey FOREIGN KEY (fallback_model_id) REFERENCES public.model_registry(id),
  CONSTRAINT subtasks_model_used_id_fkey FOREIGN KEY (model_used_id) REFERENCES public.model_registry(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  display_name character varying,
  avatar_url text,
  plan USER-DEFINED DEFAULT 'free'::user_plan_enum,
  is_active boolean DEFAULT true,
  daily_spend_cap_usd numeric DEFAULT 10.00,
  last_login_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);