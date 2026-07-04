# Database Schema Design

**Database Schema Design** | Version 1.0 | BYO-LLM Orchestrator | PostgreSQL via Supabase

Complete relational schema for the BYO-LLM multi-model orchestration platform. 12 tables across 5 domains, designed for security, cost auditability, future horizontal scaling, and zero schema migrations when adding new LLM providers or models.

**Overview:**
- 12 Tables
- 5 Domains
- PostgreSQL / Supabase
- AES-256-GCM Vault
- JSONB Flexible Fields
- Row Level Security

---

## Legend

**Domain Colors:**
- 🟡 Auth & Identity
- 🔵 LLM & Key Vault
- 🟢 Orchestration & Execution
- 🔴 Analytics & Quality
- 🟣 System

**Tags:**
- PK - Primary key
- FK - Foreign key
- IDX - Indexed
- ENC - Encrypted
- JSON - JSONB
- UNI - Unique

---

## Domain 01 — Auth & Identity

### users

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| email | varchar(320) NOT NULL | UNI, IDX |
| display_name | varchar(128) | |
| avatar_url | text | |
| plan | user_plan_enum DEFAULT 'free' | IDX |
| is_active | boolean DEFAULT true | |
| daily_spend_cap_usd | numeric(10,4) DEFAULT 10.00 | |
| last_login_at | timestamptz | |
| deleted_at | timestamptz | (soft delete) |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### sessions

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| user_id | uuid → users.id | FK, IDX |
| token_hash | varchar(64) NOT NULL | UNI, IDX |
| ip_address | inet | |
| user_agent | text | |
| expires_at | timestamptz NOT NULL | IDX |
| revoked_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

---

## Domain 02 — LLM & Key Vault

### api_key_vault

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| user_id | uuid → users.id | FK, IDX |
| provider | llm_provider_enum NOT NULL | IDX |
| encrypted_key | text NOT NULL | ENC (AES-256-GCM) |
| iv | varchar(24) NOT NULL | (GCM nonce hex) |
| auth_tag | varchar(32) NOT NULL | (GCM tag hex) |
| key_hint | varchar(8) | (last 4 chars, display only) |
| is_valid | boolean DEFAULT false | IDX |
| last_validated_at | timestamptz | |
| validation_error | text | |
| rotated_at | timestamptz | |
| revoked_at | timestamptz | (soft delete) |
| created_at | timestamptz DEFAULT now() | |

**UNIQUE (user_id, provider) WHERE revoked_at IS NULL**

### model_registry

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| provider | llm_provider_enum NOT NULL | IDX |
| model_id | varchar(128) NOT NULL | UNI, IDX (e.g. "gpt-4o") |
| display_name | varchar(128) NOT NULL | |
| strengths | jsonb | JSON (e.g. ["coding","logic"]) |
| context_window | integer NOT NULL | (tokens) |
| cost_per_1k_input | numeric(10,6) NOT NULL | (USD) |
| cost_per_1k_output | numeric(10,6) NOT NULL | (USD) |
| avg_latency_ms | integer | (p50 observed) |
| supports_streaming | boolean DEFAULT true | |
| supports_json_mode | boolean DEFAULT false | |
| is_active | boolean DEFAULT true | IDX |
| updated_at | timestamptz DEFAULT now() | |

System-managed. Add new models as rows — zero schema migrations.

---

## Domain 03 — Orchestration & Execution

### executions

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| user_id | uuid → users.id | FK, IDX |
| session_id | uuid → sessions.id | FK |
| prompt_raw | text NOT NULL | |
| prompt_category | prompt_category_enum | IDX |
| difficulty | difficulty_enum | IDX |
| status | execution_status_enum DEFAULT 'pending' | IDX |
| available_models | jsonb NOT NULL | JSON (snapshot at execution time) |
| router_model_id | uuid → model_registry.id | FK |
| final_output | text | |
| total_tokens_in | integer | |
| total_tokens_out | integer | |
| estimated_cost_usd | numeric(10,6) | (pre-execution estimate) |
| total_cost_usd | numeric(10,6) | (actual post-execution) |
| latency_ms | integer | (wall-clock end-to-end) |
| user_approved_at | timestamptz | (plan approval timestamp) |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | IDX |

### execution_plans

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| execution_id | uuid → executions.id | FK, IDX |
| version | smallint NOT NULL DEFAULT 1 | |
| plan_json | jsonb NOT NULL | JSON (full router output) |
| is_approved | boolean DEFAULT false | |
| approved_by | uuid → users.id | FK |
| approved_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

**UNIQUE (execution_id, version)**. Stores plan history across user modifications.

### subtasks

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| execution_id | uuid → executions.id | FK, IDX |
| plan_id | uuid → execution_plans.id | FK |
| sequence_order | smallint NOT NULL | |
| title | varchar(256) NOT NULL | |
| prompt_fragment | text NOT NULL | |
| assigned_model_id | uuid → model_registry.id | FK, IDX |
| fallback_model_id | uuid → model_registry.id | FK |
| model_used_id | uuid → model_registry.id | FK (actual) |
| status | subtask_status_enum DEFAULT 'pending' | IDX |
| output | text | |
| tokens_in | integer | |
| tokens_out | integer | |
| cost_usd | numeric(10,6) | |
| latency_ms | integer | |
| fallback_triggered | boolean DEFAULT false | |
| error_message | text | |
| started_at | timestamptz | |
| completed_at | timestamptz | |

---

## Domain 04 — Analytics & Quality

### confidence_scores

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| subtask_id | uuid → subtasks.id | FK, IDX |
| execution_id | uuid → executions.id | FK, IDX |
| scorer_model_id | uuid → model_registry.id | FK |
| score | smallint NOT NULL CHECK (0..100) | IDX |
| note | text | (one-line rationale) |
| raw_response | jsonb | JSON (full scorer LLM output) |
| scorer_cost_usd | numeric(10,6) | (cost of this scoring call) |
| created_at | timestamptz DEFAULT now() | |

### model_usage_stats

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| user_id | uuid → users.id | FK, IDX |
| model_id | uuid → model_registry.id | FK, IDX |
| period_date | date NOT NULL | IDX (daily rollup) |
| call_count | integer DEFAULT 0 | |
| total_tokens_in | bigint DEFAULT 0 | |
| total_tokens_out | bigint DEFAULT 0 | |
| total_cost_usd | numeric(12,6) DEFAULT 0 | |
| avg_latency_ms | integer | |
| fallback_count | integer DEFAULT 0 | |
| avg_confidence_score | numeric(5,2) | |

**UNIQUE (user_id, model_id, period_date)**. Upserted after each execution completes. Powers the analytics dashboard without full-table scans.

---

## Domain 05 — System

### audit_logs

| Field | Type | Tags |
|-------|------|------|
| id | bigserial | PK (append-only, ordered) |
| user_id | uuid → users.id | FK, IDX (nullable, pre-auth) |
| action | varchar(64) NOT NULL | IDX |
| resource_type | varchar(64) | IDX (e.g. "execution") |
| resource_id | uuid | |
| ip_address | inet | |
| metadata | jsonb | JSON (event-specific extras) |
| created_at | timestamptz DEFAULT now() | IDX |

bigserial PK (not UUID) — optimized for append-only time-range scans. Partition by month at scale.

### prompt_templates

| Field | Type | Tags |
|-------|------|------|
| id | uuid DEFAULT gen_random_uuid() | PK |
| user_id | uuid → users.id | FK, IDX (NULL = system template) |
| name | varchar(128) NOT NULL | |
| category | prompt_category_enum | IDX |
| template_body | text NOT NULL | |
| variables | jsonb | JSON (variable name + description) |
| is_public | boolean DEFAULT false | IDX |
| usage_count | integer DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

---

## Key Relationships

Foreign Key Map — read as: [table] has one-to-many [table]

- users 1 ──< N sessions (one user, many sessions)
- users 1 ──< N api_key_vault (one user, many provider keys)
- users 1 ──< N executions (full prompt history)
- users 1 ──< N model_usage_stats (daily spend rollup)
- executions 1 ──< N execution_plans (versioned plan history)
- executions 1 ──< N subtasks (decomposed task list)
- execution_plans 1 ──< N subtasks (subtasks belong to a plan version)
- subtasks 1 ──< 1 confidence_scores (quality score per subtask)
- model_registry 1 ──< N subtasks (×3) (assigned, fallback, used)
- model_registry 1 ──< N model_usage_stats (daily per-model metrics)
- model_registry 1 ──< N confidence_scores (which model scored)
- users 1 ──< N prompt_templates (user-saved templates, NULL=system)

---

## Enum Definitions

### llm_provider_enum
- openai
- anthropic
- google_gemini
- mistral
- cohere
- meta_llama
- custom

### prompt_category_enum
- research
- coding
- logic
- creative
- planning
- math
- general

### execution_status_enum
- pending
- planning
- awaiting_approval
- running
- completed
- failed
- cancelled

### difficulty_enum / subtask_status / user_plan
- difficulty: easy · medium · hard · agentic
- subtask_status: pending · running · scoring · completed · retrying · failed
- user_plan: free · pro · enterprise

---

## Index Strategy

| Table | Column(s) | Type | Rationale |
|-------|-----------|------|-----------|
| users | email | UNIQUE | Login lookup — most frequent auth query |
| sessions | token_hash | UNIQUE | Every authenticated request validates this hash |
| sessions | expires_at | BTREE | Nightly cleanup job scans expired sessions |
| api_key_vault | (user_id, provider) WHERE revoked_at IS NULL | PARTIAL UNIQUE | One active key per user per provider — enforced at DB level |
| executions | (user_id, created_at DESC) | BTREE | History page pagination — most common read pattern |
| executions | status | BTREE | Admin query: show all running/failed executions |
| subtasks | (execution_id, sequence_order) | BTREE | Ordered subtask retrieval — called on every execution fetch |
| model_usage_stats | (user_id, model_id, period_date) | UNIQUE | Upsert daily rollup atomically — prevents duplicate rows |
| audit_logs | created_at | BTREE | Time-range queries for security auditing; partition-ready |
| audit_logs | (user_id, action) | BTREE | Per-user action history — compliance and security monitoring |
| confidence_scores | score | BTREE | Filter/sort by quality score in analytics; ORDER BY score DESC |
| model_registry | strengths | GIN | JSONB array containment queries — find models with strength "coding" |

---

## Core Migration SQL

```sql
-- ENUMS
CREATE TYPE llm_provider_enum        AS ENUM ('openai','anthropic','google_gemini','mistral','cohere','meta_llama','custom');
CREATE TYPE prompt_category_enum     AS ENUM ('research','coding','logic','creative','planning','math','general');
CREATE TYPE difficulty_enum          AS ENUM ('easy','medium','hard','agentic');
CREATE TYPE execution_status_enum    AS ENUM ('pending','planning','awaiting_approval','running','completed','failed','cancelled');
CREATE TYPE subtask_status_enum      AS ENUM ('pending','running','scoring','completed','retrying','failed');
CREATE TYPE user_plan_enum           AS ENUM ('free','pro','enterprise');

-- PARTIAL UNIQUE INDEX: one active key per user per provider
CREATE UNIQUE INDEX idx_vault_active_key
  ON api_key_vault(user_id, provider)
  WHERE revoked_at IS NULL;

-- GIN index for JSONB model strengths containment queries
CREATE INDEX idx_model_strengths_gin
  ON model_registry USING GIN(strengths);

-- Composite index for history page pagination
CREATE INDEX idx_executions_user_created
  ON executions(user_id, created_at DESC);

-- ROW LEVEL SECURITY
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_vault      ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_usage_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates   ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_own_executions ON executions
  USING (user_id = auth.uid());

CREATE POLICY user_own_keys ON api_key_vault
  USING (user_id = auth.uid());

-- DAILY SPEND CAP CHECK (called before each execution)
CREATE OR REPLACE FUNCTION check_daily_spend_cap(p_user_id UUID, p_cap NUMERIC)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(SUM(total_cost_usd), 0) < p_cap
  FROM model_usage_stats
  WHERE user_id = p_user_id AND period_date = CURRENT_DATE;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- DAILY ROLLUP UPSERT (called after every execution)
INSERT INTO model_usage_stats
  (user_id, model_id, period_date, call_count, total_tokens_in, total_tokens_out, total_cost_usd)
VALUES
  ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
ON CONFLICT (user_id, model_id, period_date) DO UPDATE SET
  call_count       = model_usage_stats.call_count       + EXCLUDED.call_count,
  total_tokens_in  = model_usage_stats.total_tokens_in  + EXCLUDED.total_tokens_in,
  total_tokens_out = model_usage_stats.total_tokens_out + EXCLUDED.total_tokens_out,
  total_cost_usd   = model_usage_stats.total_cost_usd   + EXCLUDED.total_cost_usd;
```

---

## Key Design Decisions

💰 **NUMERIC not FLOAT for money**
All cost columns use `NUMERIC(10,6)` or `NUMERIC(12,6)`. IEEE 754 float arithmetic produces rounding errors that compound across thousands of rows. NUMERIC is exact. Display is rounded to 4 decimal places in the application layer — never at storage.

🔒 **Encrypted key split across 3 columns**
The encrypted key is stored as three separate columns: `encrypted_key` (ciphertext), `iv` (GCM nonce), `auth_tag` (GCM authentication tag). This makes it explicit in the schema that the encryption is authenticated, and prevents silent corruption of the auth tag.

📸 **available_models snapshot on execution**
`executions.available_models` stores the JSONB snapshot of the user's connected models at the moment of execution. This ensures historical records are accurate even if the user later adds or removes keys — critical for cost auditing and replay.

📑 **bigserial for audit_logs, not UUID**
`audit_logs.id` is `bigserial`, not `uuid`. This table is append-only and will be queried by time range. Sequential integer PKs are 4–8× faster for range scans, don't fragment B-tree indexes, and make the chronological order of log entries unambiguous.

📊 **Pre-aggregated model_usage_stats**
The analytics dashboard must never do a full scan of `subtasks` to compute spend totals. The `model_usage_stats` table is a pre-aggregated daily rollup maintained by an upsert after every execution — O(1) analytics queries regardless of execution history size.

🔃 **JSONB for evolving fields, normalized for stable ones**
Fields that change frequently without a known schema (model strengths, plan structure, template variables) use JSONB to avoid migrations. Fields with known cardinality and stable schemas (provider name, prompt category, status) use typed enums for query correctness and constraint enforcement.

🗑️ **Soft deletes on users and api_key_vault**
Both tables use a `deleted_at` / `revoked_at` timestamp instead of hard deletes. This enables GDPR right-to-erasure via a nightly job (null out PII, keep anonymized rows for cost audit), preserves referential integrity on execution history, and allows key recovery within a grace window.

🔭 **model_registry is a data table, not code**
Adding a new LLM provider (e.g. xAI Grok) requires zero schema migrations and zero code deployments — just insert a row into `model_registry` with the correct `provider` enum value, pricing, and strengths. The router, executor, and fallback manager read from this table dynamically.

---

*BYO-LLM Orchestrator — Database Schema Design v1.0*  
*12 Tables · 5 Domains · PostgreSQL via Supabase · AES-256-GCM · Row Level Security*  
*All monetary values NUMERIC(10,6) · No floats · Soft deletes · JSONB for evolving fields*
