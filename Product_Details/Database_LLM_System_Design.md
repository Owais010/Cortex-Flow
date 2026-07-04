# BYO-LLM Orchestration System Design

**System Design Document** | Version 1.0 | BYO-LLM Orchestrator | Stack: Next.js · Node.js · PostgreSQL (Supabase)

## Overview

A production-grade system design for an intelligent multi-LLM orchestration platform that lets users bring their own API keys, routes tasks dynamically across only the models they own, and returns a merged, confidence-scored result — with full auditability, cost transparency, and a real-time visualization layer.

**Tech Stack:**
- Next.js 14 Frontend
- Node.js Backend
- Supabase (PostgreSQL)
- Multi-LLM Routing
- AES-256 Key Vault
- SSE Streaming

---

## Requirements

### Functional Requirements

#### FR-01 · API Key Vault
Users submit their own LLM provider API keys (OpenAI, Anthropic, Google Gemini, Mistral, Cohere). Keys are encrypted server-side with AES-256-GCM and never returned to the browser after submission. A masked hint (last 4 chars) is displayed in the UI.

#### FR-02 · Model Registry & Detection
Upon key submission, the system validates each key with a minimal test call and builds an `availableModels[]` manifest. The router is constrained to only route to models in this list — never to models the user has not connected.

#### FR-03 · Prompt Classification
Every incoming prompt is classified by category (Research, Coding, Logic, Creative, Planning, Math, General) and by difficulty (Easy, Medium, Hard, Agentic). Classification drives decomposition and model assignment decisions.

#### FR-04 · Router LLM Brain
A dedicated LLM call generates the execution plan: prompt category, difficulty, subtask list, model assignment per subtask, estimated token cost, and estimated latency. The plan is presented to the user before any real execution starts.

#### FR-05 · User Plan Approval
Before execution begins, users see the full plan with cost estimate and time estimate. They can approve, modify subtasks, or cancel. Execution only starts after explicit approval. Plan version history is persisted.

#### FR-06 · Multi-LLM Execution Engine
Executes each subtask sequentially or in parallel against the assigned available model. Captures per-subtask output, actual token counts, actual cost, and latency. Aggregates all outputs into a final merged response.

#### FR-07 · Fallback System
If a model call fails (rate limit, API error, timeout), the system automatically retries the subtask using the next available model in the user's list. Fallback events are logged and surfaced in the analytics panel.

#### FR-08 · Live Streaming Output
Execution output streams token-by-token to the frontend via Server-Sent Events (SSE). The UI shows which model is currently running, live token count, running cost ticker, and per-subtask progress.

#### FR-09 · Reasoning Graph
An animated DAG (React Flow) visualizes the full execution in real time: Prompt node → Classifier → Subtask nodes → Model nodes (GPT / Claude / Gemini) → Output node. Nodes light up as each stage completes.

#### FR-10 · Confidence Scoring
After each subtask completes, a secondary LLM call (cheapest available model) evaluates response quality and returns a score 0–100 with a one-sentence rationale. Scores are displayed per-subtask in the results panel.

#### FR-11 · Analytics & Logging
Every execution logs: prompt category, models used, actual vs estimated tokens, actual vs estimated cost, latency, fallback events, and confidence scores. These feed a per-user analytics dashboard with cost trends and model performance.

#### FR-12 · Prompt Templates
System-level and user-saved prompt templates. Templates are categorized, searchable, and can be pre-loaded into the prompt input. Future: template marketplace with usage counts and community sharing.

---

## Constraints & Assumptions

### Hard Constraints

🔴 **API keys MUST NEVER transit to the browser** after initial submission. All LLM calls originate server-side. No exceptions.

🔴 **The router MUST only assign models** from the user's `availableModels[]`. Any plan that references a model not in this list must be rejected by a post-plan validator before being shown to the user.

⚠️ **Execution MUST NOT begin before explicit user approval** of the plan. Execution and planning are separate request lifecycles.

⚠️ **All monetary values stored as `NUMERIC(10,6)`** — never floating point. Cost display rounded to 4 decimal places.

### Assumptions

**Session Model (MVP):** For the hackathon MVP, user identity is session-based (UUID in localStorage). Full auth (email/password or OAuth) is a post-MVP concern. The schema already supports a `users` table for this migration.

**Provider Coverage:** MVP supports OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude Sonnet, Haiku), Google (Gemini 1.5 Flash, Pro). Extensible via `model_registry` table with no code changes per new model.

**Sequential Execution (MVP):** Subtasks execute sequentially in MVP. Parallel execution is an architectural concern but deferred. The `sequence_order` column on `subtasks` supports future parallel execution graphs.

---

## High-Level Architecture

The system is a 3-tier web application with a security boundary between the browser and all LLM provider calls. Every LLM interaction originates from the Node.js backend.

### System Tiers

**Frontend:**
- Next.js 14 (App Router)
- React Flow DAG
- Framer Motion
- Tailwind CSS
- SSE Client (EventSource)
- SWR / React Query

**API Gateway:**
- Node.js + Express (or Fastify)
- CORS enforcement
- Rate limiting (express-rate-limit)
- Helmet.js security headers
- Request validation (Zod)

**Orchestration:**
- Key Vault (AES-256-GCM)
- Router LLM Brain
- Classifier + Decomposer
- Execution Engine
- Fallback Manager
- Token + Cost Estimator
- Confidence Scorer
- Response Aggregator

**Data Layer:**
- Supabase (PostgreSQL)
- Row Level Security
- Supabase Realtime (future)
- pgcrypto extension

**External LLMs:**
- OpenAI API
- Anthropic API
- Google Gemini API
- Mistral API
- Cohere API
- [Extensible]

---

## Core Pipeline Flow

**Key Submission Flow:**
Browser → Submit API Keys → Key Vault (AES-256-GCM) → Validate Key (Test LLM call) → availableModels[] manifest built

**Planning Flow:**
User Prompt → Classifier (category + difficulty) → Router LLM (plan from availableModels) → Cost Estimator (tokens + $) → Plan Preview (shown to user)

**Execution Flow:**
User Approves → Execution Engine (subtask loop) → Fallback Manager (retry on failure) → Confidence Scorer (per subtask) → Aggregator (merge outputs)

**Streaming Flow:**
SSE Stream (live to browser) → React Flow DAG (animates live) → Analytics Logger (Supabase write) → Final Result (+ per-subtask scores)

---

## Component Deep Dives

### Backend Module Map

🔐 **Security Vault** (`security/vault.js`)
- **Responsibility:** Encrypt on key ingestion, decrypt only at LLM call time
- **Algorithm:** AES-256-GCM with a unique IV per key, derived from `ENCRYPTION_KEY` env var via PBKDF2
- **Interfaces:** `encryptKey(plaintext) → {ciphertext, iv}` · `decryptKey(ciphertext, iv) → plaintext`
- **Rule:** Decrypted key lives in memory for <50ms. Never logged, never returned, never stored in any variable that persists beyond the LLM call scope

🧠 **Router LLM Brain** (`core/router.js`)
- **Responsibility:** Receive prompt + availableModels, output a complete execution plan as structured JSON
- **System Prompt Strategy:** Injects availableModels[] as a hard constraint. The LLM is instructed to return ONLY JSON — no prose. Output is validated with a Zod schema post-parse
- **Post-plan Validator:** Every model in the plan's subtask array is checked against availableModels[]. Any plan referencing an unavailable model is rejected and a re-plan is triggered (max 2 retries)

⚡ **Execution Engine** (`core/executor.js`)
- **Responsibility:** Execute each subtask against its assigned model, in sequence, streaming output back via SSE
- **For each subtask:** Fetch encrypted key → decrypt → call provider SDK → stream tokens → accumulate output → call confidence scorer → log to DB → move to next subtask
- **Context passing:** Each subtask receives the output of the previous subtask as context, enabling chained reasoning for complex tasks

🔁 **Fallback Manager** (`core/fallback.js`)
- **Triggers:** HTTP 429 (rate limit), HTTP 5xx (provider error), connection timeout (>30s), empty response
- **Strategy:** Try next available model in user's list, ordered by cost (cheapest first as fallback). Max 2 fallback attempts per subtask
- **Logging:** Every fallback event logged to `audit_logs` and surfaced in the frontend with "⚠ fell back to {model}" indicator

💰 **Token + Cost Estimator** (`core/estimator.js`)
- **Pre-execution:** Counts tokens in prompt + system prompt using `tiktoken` (OpenAI) or Anthropic token API. Multiplies by per-model pricing from `model_registry` table. Returns estimate before user approves
- **Post-execution:** Reads actual token counts from provider response headers/objects. Stores both estimated and actual for accuracy tracking

📊 **Confidence Scorer** (`core/confidence.js`)
- **Trigger:** Runs after every subtask completes
- **Mechanism:** Sends a secondary LLM call (to the cheapest available model) with the task title + truncated output. Returns `{"score": 0-100, "note": "one sentence"}` using JSON mode
- **Cost management:** Output is truncated to 1000 chars to minimize scorer cost. Scorer cost itself is logged separately

### Frontend Module Map

**Screen 1: Key Vault UI**
Per-provider input fields. On submit: POST to backend → response shows status dot only (green/red). Input field is cleared from DOM immediately. Key hint (last 4 chars) shown in connected state.

**Screen 2: Prompt + Plan Preview**
Textarea for prompt. On "Analyze": POST /api/plan → renders subtask list, model assignments, cost estimate, time estimate. Approve button triggers POST /api/execute + SSE connection.

**Screen 3: Execution + Results**
React Flow DAG animates live. Per-subtask streaming panel. Running token counter + cost ticker. On completion: final merged output, per-subtask confidence scores, analytics summary cards.

---

## Data Flow & State Transitions

### API Key Lifecycle

| Stage | Data State | Location | Lifetime |
|-------|-----------|----------|----------|
| User types key | Plaintext | Browser input field (memory only) | Until POST fires |
| POST /api/keys body | Plaintext in HTTPS payload | TLS-encrypted in transit | Transit only |
| Server receives | Plaintext in Node.js memory | Request handler scope | <100ms |
| Validation call | Plaintext passed to provider SDK | Server memory + TLS to provider | <2s |
| Post-validation | AES-256-GCM encrypted (ciphertext + IV) | Supabase `api_key_vault` table | Until user deletes |
| At LLM call time | Plaintext decrypted in handler scope | Server memory only | <50ms, never logged |
| Browser (ever) | Key hint only (e.g. "…k3x9") | API response JSON | Session |

### Execution State Machine

IDLE → prompt submitted → PLANNING → plan ready → AWAITING_APPROVAL → user approves → RUNNING

RUNNING → all subtasks done → COMPLETED
RUNNING → all fallbacks exhausted → FAILED

💡 Each `execution.status` transition is an atomic DB write. The frontend polls `/api/executions/{id}/status` or receives updates via SSE events of type `status_change`.

### Subtask Status Flow

pending → running → scoring → completed

running → error → retrying → fallback ok → scoring

retrying → all models exhausted → failed

---

## API Design

RESTful API with one SSE endpoint for streaming. All endpoints use JSON. All requests include session-id in the Authorization header or as a query param for GET requests.

### Endpoint Catalog

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| POST | `/api/keys` | Submit an API key for a provider. Validates, encrypts, stores. Returns status only. | session-id | `{"provider":"openai","status":"active","hint":"k3x9"}` |
| DEL | `/api/keys/:provider` | Revoke and delete a provider's key. Soft-deleted with `revoked_at` timestamp. | session-id | `{"deleted":true}` |
| GET | `/api/models` | Returns the user's available model manifest. Only models with active, valid keys appear. | session-id | `{"models":["gpt-4o","claude-sonnet-4"]}` |
| POST | `/api/plan` | Generate execution plan for a prompt. Triggers classifier → router LLM → cost estimator. Does NOT execute. | session-id | Full plan JSON with subtasks, model assignments, cost/time estimate |
| POST | `/api/plan/:id/approve` | User approves a generated plan. Creates the `execution` record and marks it AWAITING_EXECUTION. | session-id | `{"execution_id":"uuid","status":"approved"}` |
| POST | `/api/execute` | Starts execution of an approved plan. Body includes `plan_id`. Initiates the subtask loop server-side. | session-id | `{"execution_id":"uuid","stream_url":"/api/stream/uuid"}` |
| SSE | `/api/stream/:execution_id` | Server-Sent Events stream. Sends typed events: `token`, `subtask_start`, `subtask_complete`, `confidence_score`, `execution_complete`, `error`. | session-id | SSE event stream |
| GET | `/api/executions` | Paginated history of user's executions. Supports filters: category, model, date range. Default: last 20. | session-id | Paginated list with summary stats |
| GET | `/api/executions/:id` | Full detail of a single execution including all subtasks, confidence scores, and cost breakdown. | session-id | Full execution object |
| GET | `/api/analytics/summary` | Aggregated stats for the user: total spend, most-used models, avg confidence, fallback rate. Used for the analytics dashboard. | session-id | Analytics summary object |
| GET | `/api/templates` | List of system and user-saved prompt templates. Filterable by category. | optional | Template list |
| POST | `/api/templates` | Save a new user prompt template with name, category, body, and variable definitions. | session-id | Created template |

### SSE Event Schema

```typescript
// All SSE events share this envelope
type SSEEvent = {
  type: 'token' | 'subtask_start' | 'subtask_complete'
      | 'confidence_score' | 'fallback' | 'execution_complete' | 'error';
  execution_id: string;
  timestamp: string;  // ISO 8601
  data: TokenEvent | SubtaskEvent | ConfidenceEvent | CompleteEvent | ErrorEvent;
}

type TokenEvent = {
  subtask_id: string;
  model: string;
  token: string;           // The streamed token fragment
  tokens_so_far: number;
  cost_so_far: number;
}

type SubtaskEvent = {
  subtask_id: string;
  title: string;
  model: string;
  status: 'started' | 'completed' | 'failed';
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  latency_ms?: number;
  output?: string;         // only on 'completed'
}

type ConfidenceEvent = {
  subtask_id: string;
  score: number;           // 0-100
  note: string;
}

type CompleteEvent = {
  final_output: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  total_latency_ms: number;
}
```

### Router LLM Output Contract

```json
{
  "execution_id": "uuid",
  "prompt_category": "Research",
  "difficulty": "Hard",
  "needs_decomposition": true,
  "subtasks": [
    {
      "id": "sub-1",
      "title": "Market landscape analysis",
      "prompt_fragment": "Analyze the current AI travel startup landscape...",
      "assigned_model": "claude-sonnet-4",
      "fallback_model": "gpt-4o",
      "sequence_order": 1,
      "rationale": "Claude excels at structured research synthesis"
    },
    {
      "id": "sub-2",
      "title": "Competitive differentiation",
      "prompt_fragment": "Given the landscape above, identify gaps...",
      "assigned_model": "gpt-4o",
      "fallback_model": "claude-sonnet-4",
      "sequence_order": 2,
      "rationale": "GPT-4o strong for comparative structured analysis"
    }
  ],
  "cost_estimate": {
    "total_usd": 0.038,
    "breakdown": [
      {"subtask_id": "sub-1", "model": "claude-sonnet-4", "estimated_usd": 0.021},
      {"subtask_id": "sub-2", "model": "gpt-4o", "estimated_usd": 0.017}
    ]
  },
  "time_estimate_seconds": 24
}
```

---

## Security Architecture

Security is the core value proposition. Every layer has specific controls. The threat model assumes a compromised database should not expose any LLM provider keys in usable form.

### Threat Model

**T1 · Database Breach**
- **Mitigation:** Keys stored as AES-256-GCM ciphertext + IV. The encryption key lives only in the server's environment variables (not in the DB). A DB dump alone yields no usable keys.

**T2 · Key Exfiltration via API**
- **Mitigation:** All API endpoints return only key hints, never ciphertext, never plaintext. The decrypted key never appears in any API response, log line, or error message.

**T3 · XSS Attack**
- **Mitigation:** Next.js default CSP headers. Helmet.js on backend. No key material ever written to DOM, localStorage, or sessionStorage. React's default XSS escaping in JSX.

**T4 · Session Hijacking**
- **Mitigation:** Session tokens are UUIDs (unpredictable). Short expiry (24h). HTTPOnly + SameSite cookies (post-MVP). Session revocation on logout clears all vault entries.

**T5 · SSRF / Prompt Injection**
- **Mitigation:** Router LLM output is validated by Zod schema — no raw router output is executed as code. Model assignments are cross-checked against the whitelist. User prompt is treated as data, never as instruction to the application layer.

**T6 · Cost Abuse**
- **Mitigation:** Per-user daily spend cap enforced server-side. If `model_usage_stats.total_cost_usd` for today exceeds the cap, new executions are rejected with HTTP 429. Cap is configurable per user plan.

**T7 · Replay Attacks on Plan Approval**
- **Mitigation:** Each plan has a one-time approval token. Once approved, the plan_id cannot be re-approved. The `is_approved` flag + `approved_by` + `approved_at` are set atomically.

**T8 · Rate Limit Exhaustion**
- **Mitigation:** `express-rate-limit` per IP: 60 req/min on /api/plan, 10 req/min on /api/execute. Additionally, per-session rate limiting at DB level tracks execution count/hour.

### Encryption Details

```javascript
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH  = 12;  // 96 bits — GCM standard
const TAG_LENGTH = 16;  // 128 bits auth tag

// Key derived once at startup — never stored in DB
const MASTER_KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY,
  process.env.ENCRYPTION_SALT,
  KEY_LENGTH
);

function encryptKey(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store: iv (hex) + ':' + tag (hex) + ':' + ciphertext (hex)
  return {
    encrypted: `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`,
  };
}

function decryptKey(stored) {
  const [ivHex, tagHex, ciphertextHex] = stored.split(':');
  const iv         = Buffer.from(ivHex, 'hex');
  const tag        = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher   = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
  // plaintext is used immediately and goes out of scope — GC'd within milliseconds
}
```

---

## Router LLM Engine

The Router is the intellectual core of the system. It receives a user prompt and the available model manifest, and produces a deterministic, validated JSON execution plan.

### Router System Prompt Design

```
You are an intelligent LLM task router. Your job is to analyze a user prompt and
create an optimal execution plan using ONLY the models listed below.

AVAILABLE MODELS (you MUST only use models from this list):
{availableModels}

MODEL STRENGTHS (use this to assign the best model per subtask):
{modelStrengths}   // pulled from model_registry.strengths JSONB

RULES:
1. NEVER reference a model not in AVAILABLE MODELS — plans with unknown models are rejected.
2. If only one model is available, assign all subtasks to it.
3. For Easy difficulty: single subtask, single model, no decomposition needed.
4. For Hard/Agentic: decompose into 2-5 focused subtasks. Assign strongest model per subtask type.
5. fallback_model must also be in AVAILABLE MODELS and must differ from assigned_model.
6. Respond ONLY with a valid JSON object. No preamble, no explanation, no markdown.

OUTPUT FORMAT:
{"prompt_category":..., "difficulty":..., "needs_decomposition":..., "subtasks":[...],
 "cost_estimate":{...}, "time_estimate_seconds":...}

USER PROMPT:
{userPrompt}
```

### Post-Plan Validation Logic

```javascript
const planSchema = z.object({
  prompt_category: z.enum(['Research','Coding','Logic','Creative','Planning','Math','General']),
  difficulty: z.enum(['Easy','Medium','Hard','Agentic']),
  needs_decomposition: z.boolean(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string().max(256),
    prompt_fragment: z.string(),
    assigned_model: z.string(),
    fallback_model: z.string(),
    sequence_order: z.number().int().min(1),
    rationale: z.string(),
  })).min(1).max(8),
  cost_estimate: z.object({
    total_usd: z.number().positive(),
    breakdown: z.array(z.object({
      subtask_id: z.string(),
      model: z.string(),
      estimated_usd: z.number().nonnegative(),
    })),
  }),
  time_estimate_seconds: z.number().positive(),
});

function validatePlan(rawPlan, availableModels) {
  // 1. Structural validation via Zod
  const plan = planSchema.parse(rawPlan);

  // 2. Hard model constraint check — the most critical rule
  for (const subtask of plan.subtasks) {
    if (!availableModels.includes(subtask.assigned_model))
      throw new PlanValidationError(`assigned_model "${subtask.assigned_model}" not available`);
    if (!availableModels.includes(subtask.fallback_model))
      throw new PlanValidationError(`fallback_model "${subtask.fallback_model}" not available`);
    if (subtask.assigned_model === subtask.fallback_model)
      throw new PlanValidationError(`assigned and fallback models must differ`);
  }

  return plan;
}
```

---

## Execution Engine

The execution engine is a stateful loop that processes each subtask, handles failures, streams output, scores quality, and aggregates the final result.

### Execution Loop Pseudocode

```javascript
async function executeApprovedPlan(executionId, plan, sessionId, sseWriter) {
  await db.executions.updateStatus(executionId, 'running');
  sseWriter.send({ type: 'status_change', data: { status: 'running' } });

  let accumulatedContext = '';  // passed between subtasks for chained reasoning

  for (const subtask of plan.subtasks.sort((a,b) => a.sequence_order - b.sequence_order)) {
    await db.subtasks.updateStatus(subtask.id, 'running');
    sseWriter.send({ type: 'subtask_start', data: { subtask_id: subtask.id, model: subtask.assigned_model } });

    let result = null;
    let modelUsed = subtask.assigned_model;
    let fallbackTriggered = false;

    // Try primary, then fallback
    for (const model of [subtask.assigned_model, subtask.fallback_model]) {
      try {
        const encryptedKey = await db.apiKeyVault.getKey(sessionId, modelToProvider(model));
        const apiKey = decryptKey(encryptedKey.encrypted);  // <-- plaintext in scope <50ms

        const fullPrompt = buildPrompt(subtask.prompt_fragment, accumulatedContext);
        result = await callLLMWithStreaming(model, apiKey, fullPrompt, sseWriter, subtask.id);
        apiKey = null;  // explicit null — allow GC before confidence scoring

        modelUsed = model;
        fallbackTriggered = (model !== subtask.assigned_model);
        break;
      } catch (err) {
        if (err.status === 429 || err.status >= 500 || err.code === 'ETIMEDOUT') {
          sseWriter.send({ type: 'fallback', data: { subtask_id: subtask.id, from: model } });
          fallbackTriggered = true;
          continue;
        }
        throw err;  // non-retryable error — surface to user
      }
    }

    if (!result) {
      await db.subtasks.updateStatus(subtask.id, 'failed');
      sseWriter.send({ type: 'error', data: { subtask_id: subtask.id, message: 'All models exhausted' }});
      continue;
    }

    // Confidence scoring (async, non-blocking to UX)
    const score = await confidenceScorer.score(subtask.title, result.output, sessionId);
    sseWriter.send({ type: 'confidence_score', data: { subtask_id: subtask.id, score: score.score, note: score.note }});

    await db.subtasks.complete(subtask.id, { ...result, fallbackTriggered, modelUsed, score });

    accumulatedContext += `\n\n[${subtask.title}]:\n${result.output}`;
  }

  const finalOutput = aggregateOutputs(plan.subtasks);
  await db.executions.complete(executionId, finalOutput);
  sseWriter.send({ type: 'execution_complete', data: { final_output: finalOutput } });
  sseWriter.close();
}
```

---

## Streaming Architecture (SSE)

Server-Sent Events are chosen over WebSockets because the data flow is unidirectional (server → browser). SSE is simpler, HTTP-compatible, and auto-reconnects natively.

### Why SSE over WebSocket

✓ **Unidirectional:** All stream data flows server → client. The browser has no need to push data back during streaming. SSE is purpose-built for this pattern.

✓ **HTTP Compatible:** SSE works over standard HTTP/2. No WebSocket upgrade handshake. Compatible with all CDNs, load balancers, and reverse proxies without special config.

✓ **Auto-Reconnect:** The browser's EventSource API automatically reconnects on disconnect, using the Last-Event-ID header to resume. No client-side reconnection logic needed.

### Backend SSE Setup

```javascript
app.get('/api/stream/:executionId', async (req, res) => {
  const { executionId } = req.params;
  const sessionId = req.headers['x-session-id'];

  // Verify this execution belongs to this session
  const execution = await db.executions.findByIdAndSession(executionId, sessionId);
  if (!execution) return res.status(404).json({ error: 'Not found' });

  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
  res.flushHeaders();

  const sseWriter = {
    send: (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    },
    close: () => res.end()
  };

  // ... stream execution logic
});
```

---

*BYO-LLM Orchestrator — System Design Document v1.0*
