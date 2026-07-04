# Backend Implementation Plan - M1 Backend Engineer

**Project:** Agent Ascend / BYO-LLM Orchestrator  
**Backend folder:** `backend/`  
**Product docs folder:** `Product_Details/`  
**Updated for current repo state:** 2026-05-09

---

## 1. Product Picture

Agent Ascend is a bring-your-own-key multi-LLM orchestration app.

The target flow is:

```text
User connects API keys
  -> backend validates and stores keys
  -> backend exposes only models available from connected keys
  -> user submits a prompt
  -> backend creates an execution plan using only available models
  -> user approves the plan
  -> backend executes subtasks on assigned models
  -> backend retries failed subtasks with fallback models
  -> backend returns merged final output plus cost, tokens, latency, and confidence data
  -> frontend displays plan, execution status, result details, and analytics
```

The most important backend rule is: **API keys must never be returned to the browser after submission. All LLM calls must happen server-side.**

---

## 2. What Has Already Been Built

### 2.1 Frontend already built enough to call backend

The Next.js app already has these pieces:

- Login/auth pages exist under `app/login` and `app/auth/callback`.
- Chat page and chat state exist under `app/chat/page.tsx` and `app/lib/context.tsx`.
- API client exists at `app/lib/api.ts`.
- Settings page can submit provider keys to backend:
  - `POST http://localhost:8000/api/keys`
  - `GET http://localhost:8000/api/keys/models?session_id=...`
- Chat prompt flow expects backend plan endpoint:
  - `POST http://localhost:8000/api/plan`
- Approve button expects backend execution endpoint:
  - `POST http://localhost:8000/api/execute`
- UI components already exist for:
  - API key connection cards
  - available models table
  - execution plan message
  - executing state message
  - final result and analytics details
  - confidence score display
  - fallback warning display

### 2.2 Backend foundation already built

Existing backend files:

```text
backend/
  index.js
  package.json
  package-lock.json
  README.md
  core/
    classifier.js
    executor.js
    router.js
    token_counter.js
  db/
    analytics.js
    setup.sql
    supabase.js
  routes/
    execute.js
    keys.js
    plan.js
  security/
    vault.js
```

Implemented:

- Express server in `backend/index.js`.
- CORS enabled.
- Helmet security middleware enabled.
- Rate limiting enabled.
- JSON body parsing enabled.
- Health check endpoint:
  - `GET /health`
- Route mounting:
  - `/api/keys`
  - `/api/plan`
  - `/api/execute`
- Supabase client exists in `db/supabase.js`.
- Initial Supabase setup SQL exists in `db/setup.sql`.
- API key submission route exists in `routes/keys.js`.
- Model listing route exists in `routes/keys.js` as `GET /api/keys/models`.
- Provider validation functions exist for:
  - OpenAI
  - Anthropic
  - Google Gemini

### 2.3 Backend API key flow partially built

`routes/keys.js` already does:

- Accepts `{ provider, api_key, session_id }`.
- Validates provider is one of:
  - `openai`
  - `anthropic`
  - `google_gemini`
- Attempts a cheap provider validation call.
- Stores key metadata in Supabase.
- Returns only provider status and key hint, not the full key.
- Returns available models from `model_registry` for providers with valid keys.

### 2.4 Current frontend/backend contract

Frontend expects this plan response from `POST /api/plan`:

```ts
interface Plan {
  planId: string;
  prompt: string;
  category: string;
  difficulty: string;
  needsDecomposition: boolean;
  availableModels: string[];
  subtasks: {
    id: number;
    title: string;
    assignedModel: string;
    prompt?: string;
    estimatedTokens?: number;
    estimatedCost?: number;
    estimatedTime?: number;
  }[];
  totalEstimate: {
    tokens: number;
    cost: number;
    timeSeconds: number;
  };
}
```

Frontend expects this execution response from `POST /api/execute`:

```ts
interface ExecutionResult {
  planId: string;
  status: 'completed' | 'partial' | 'failed';
  subtaskResults: {
    id: number;
    title: string;
    model: string;
    output: string;
    tokens?: number;
    cost?: number;
    latencyMs?: number;
    usedFallback?: boolean;
    confidenceScore?: number;
    confidenceNote?: string;
  }[];
  finalOutput: string;
  analytics: {
    totalTokens: number;
    totalCost: number;
    totalTimeMs: number;
    modelsUsed: string[];
  };
}
```

---

## 3. Critical Gaps Found in Current Backend

These are the things the backend engineer must fix/build next.

### 3.1 Security gap: `security/vault.js` is not encrypting

Current file says hackathon mode and passes keys through as plaintext.

Required:

- Replace plaintext passthrough with AES-256-GCM encryption.
- Use `ENCRYPTION_KEY` from `.env`.
- Store encrypted payload only.
- Never log raw API keys.
- Never return raw API keys.

This is the highest-priority fix because the product requirement explicitly says keys are encrypted server-side.

### 3.2 Database column mismatch

`db/setup.sql` creates `api_key_vault.session_id`, but `routes/keys.js` reads/writes `user_id`.

Current code uses:

```js
.eq('user_id', session_id)
.insert({ user_id: session_id, ... })
```

Current SQL has:

```sql
session_id TEXT NOT NULL
```

Required: choose one naming convention and make backend plus SQL match.

Recommended for MVP: use `session_id` everywhere because the frontend passes `session_id` and setup SQL already has it.

### 3.3 `GET /api/models` mismatch with docs

Docs mention `GET /api/models`, but current backend exposes:

```text
GET /api/keys/models?session_id=...
```

Frontend currently calls `/api/keys/models`, so this works for the UI. Optional improvement: also add an alias route `GET /api/models` to match docs.

### 3.4 Router brain is not built

Current files are placeholders:

- `routes/plan.js`
- `core/router.js`
- `core/classifier.js` should be verified/finished
- `core/token_counter.js` should be verified/finished

Required:

- Classify prompt category.
- Detect difficulty.
- Decide if decomposition is needed.
- Create subtasks.
- Assign each subtask only to available models.
- Estimate tokens, cost, and time.
- Validate final plan before returning it to frontend.

### 3.5 Execution engine is not built

Current files are placeholders:

- `routes/execute.js`
- `core/executor.js`

Required:

- Receive approved plan.
- Load encrypted provider keys from Supabase.
- Decrypt only server-side immediately before LLM calls.
- Execute subtasks sequentially first for MVP.
- Retry with fallback models if a model call fails.
- Aggregate subtask outputs into final response.
- Return the exact `ExecutionResult` shape expected by frontend.

### 3.6 Analytics module is not built

`db/analytics.js` is placeholder.

Required:

- Log each execution.
- Store prompt category, difficulty, models used, tokens, cost, latency, fallback events, and confidence scores.
- Expose history/analytics later if time allows.

### 3.7 Streaming is not built

Product design asks for SSE streaming, but frontend currently uses normal `POST /api/execute` and waits for a complete JSON response.

Recommended MVP path:

1. Build non-streaming `/api/execute` first.
2. Add optional `POST /api/execute/stream` or `GET /api/execute/stream/:id` only after the basic demo works.

---

## 4. Team Responsibilities: Built vs Still Required

### M1 - Backend & Orchestration Engineer

Owner of:

- API key vault
- model registry access
- router LLM brain
- task decomposition
- execution engine
- fallback logic
- backend API contracts
- server-side LLM calls

Already built:

- Express backend skeleton.
- Health endpoint.
- API key submission route.
- Provider validation functions.
- Available models route.
- Initial DB setup SQL.

Still required:

1. Fix vault encryption.
2. Fix `session_id` vs `user_id` DB mismatch.
3. Implement `/api/plan`.
4. Implement router/decomposition logic.
5. Implement plan validator.
6. Implement `/api/execute`.
7. Implement model call adapters for OpenAI, Anthropic, Gemini.
8. Implement fallback model selection.
9. Implement result aggregation.
10. Implement analytics logging hooks.
11. Add tests or scripts proving each route works.

### M2 - Frontend & Visualization Engineer

Owner of:

- Next.js user experience
- API key connection UI
- prompt input
- execution plan preview
- approve/cancel UX
- reasoning graph visualization
- live execution view
- final result and analytics display
- demo polish

Already built:

- Main UI structure.
- Chat state/context.
- Settings page for provider keys.
- Available models table.
- Prompt submission flow.
- Plan display component.
- Approve and execute flow.
- Result detail display with cost/tokens/latency/confidence.

Still required:

1. Handle backend errors more gracefully in UI.
2. Add cancel behavior for plan card.
3. Add modify-subtask flow if desired.
4. Add reasoning graph visualization using the plan and execution result.
5. Add true streaming UI only after backend supports SSE.
6. Add demo mode/cached sample data for reliability.
7. Polish loading states, empty states, and mobile layout.

### M3 - Integration, Data & QA Engineer

Owner of:

- token/cost estimation
- Supabase schema correctness
- analytics logging
- confidence scoring
- end-to-end testing
- demo script and pitch deck

Already partly built:

- Initial `model_registry` cost fields exist in SQL.
- Frontend result UI can display confidence fields if backend returns them.
- Backend has placeholder `db/analytics.js`.

Still required:

1. Verify Supabase schema matches backend code exactly.
2. Add missing execution/history tables if not already in Supabase.
3. Build token and cost estimation helpers.
4. Connect estimator into `/api/plan`.
5. Build confidence scoring helper.
6. Connect confidence scoring into `/api/execute`.
7. Build analytics logging in `db/analytics.js`.
8. Run full E2E tests:
   - connect key
   - list models
   - generate plan
   - approve execution
   - receive result
   - verify DB logs
9. Prepare demo prompts and fallback/cached demo plan.

---

## 5. Backend Engineer Step-by-Step Implementation Plan

This is the actual implementation order for the backend engineer.

---

### Step 0 - Confirm backend runs

Commands:

```bash
cd backend
npm install
npm start
```

Verify:

```bash
curl http://localhost:8000/health
```

Expected:

```json
{
  "status": "ok",
  "message": "BYO-LLM Orchestrator Backend is running"
}
```

Do not move on until this works.

---

### Step 1 - Fix the database naming mismatch

Open:

- `backend/routes/keys.js`
- `backend/db/setup.sql`

Use `session_id` consistently.

Change all Supabase queries in `routes/keys.js` from `user_id` to `session_id`:

```js
.eq('session_id', session_id)
.insert({ session_id, provider, encrypted_key: encryptedKey, ... })
```

Validation:

- Submit a key from the frontend settings page.
- Confirm Supabase row has `session_id` filled.
- Confirm no `user_id` database error occurs.

---

### Step 2 - Re-enable AES-256-GCM encryption

Replace `security/vault.js` plaintext passthrough.

Implementation requirements:

- Use Node `crypto` module.
- Derive a 32-byte key from `process.env.ENCRYPTION_KEY` with SHA-256 for stable MVP behavior.
- Use `aes-256-gcm`.
- Generate a 12-byte random IV per encryption.
- Store payload as a string containing IV, auth tag, ciphertext.
- Throw clear error if encryption key is missing.

Recommended payload format:

```text
v1:<iv_base64>:<tag_base64>:<ciphertext_base64>
```

Validation:

```js
const encrypted = encryptKey('sk-test-1234')
const decrypted = decryptKey(encrypted)
console.log(encrypted !== 'sk-test-1234') // true
console.log(decrypted === 'sk-test-1234') // true
```

Also check Supabase: `encrypted_key` must not contain the raw key.

---

### Step 3 - Harden API key route

In `routes/keys.js`:

1. Never log `api_key`.
2. Return validation errors without exposing secrets.
3. If validation fails, decide MVP behavior:
   - Recommended: store invalid key metadata but not use it for models.
   - Current behavior already stores with `is_valid: false`.
4. Fix Google validation if `genAI.listModels()` is unavailable in installed SDK version.
   - Alternative cheap validation: create a model and call `generateContent('hi')` with a tiny prompt.
5. Add optional route alias:

```text
GET /api/models?session_id=...
```

This can call the same logic as `GET /api/keys/models`.

Validation:

- Invalid key returns `status: invalid`.
- Valid key returns `status: active`.
- Response never includes `api_key` or `encrypted_key`.
- `GET /api/keys/models` returns models only for valid connected providers.

---

### Step 4 - Verify model registry data

Current `db/setup.sql` seeds 9 models:

- OpenAI:
  - `gpt-4o`
  - `gpt-4o-mini`
  - `gpt-4-turbo`
- Anthropic:
  - `claude-3-5-sonnet-20241022`
  - `claude-3-haiku-20240307`
  - `claude-3-opus-20240229`
- Google Gemini:
  - `gemini-1.5-pro`
  - `gemini-1.5-flash`
  - `gemini-2.0-flash`

Validation query in Supabase:

```sql
select provider, model_id, is_active
from model_registry
order by provider, model_id;
```

Make sure model IDs match the SDK call names used in execution.

---

### Step 5 - Implement token and cost helpers

Open:

- `core/token_counter.js`

Build these functions:

```js
estimateTokens(text)
estimateCost(inputTokens, outputTokens, modelRecord)
estimateLatencySeconds(subtasks, modelRecords)
```

MVP token estimate:

```js
Math.ceil(text.length / 4)
```

Cost formula:

```js
(inputTokens / 1000) * model.cost_per_1k_input
+ (outputTokens / 1000) * model.cost_per_1k_output
```

Use model registry prices as source of truth.

Validation:

- Unit test a prompt and confirm nonzero token estimate.
- Confirm total plan estimate equals sum of subtask estimates.

---

### Step 6 - Implement prompt classifier

Open:

- `core/classifier.js`

Build:

```js
classifyPrompt(prompt)
detectDifficulty(prompt)
shouldDecompose(prompt, difficulty)
```

MVP logic can be deterministic keyword/length based:

Categories:

- `research`
- `coding`
- `logic`
- `creative`
- `planning`
- `math`
- `general`

Difficulty:

- `easy`
- `medium`
- `hard`
- `agentic`

Suggested rules:

- Coding keywords -> `coding`.
- Math keywords -> `math`.
- Research keywords -> `research`.
- If prompt length > 800 or asks for multiple deliverables -> `hard`.
- If prompt asks to build, compare, test, deploy, or multi-step workflow -> `agentic`.
- Decompose if `hard` or `agentic`.

This deterministic classifier is acceptable for MVP and avoids spending tokens before plan generation.

---

### Step 7 - Implement `/api/plan`

Open:

- `routes/plan.js`
- `core/router.js`

Request body from frontend:

```json
{
  "session_id": "user-or-session-id",
  "prompt": "user prompt",
  "available_models": ["gpt-4o-mini", "claude-3-haiku-20240307"]
}
```

Route responsibilities:

1. Validate `session_id` exists.
2. Validate `prompt` exists.
3. Get actual available models from DB for session.
4. Intersect DB models with frontend `available_models`.
5. Reject if no available models.
6. Call `generatePlan(prompt, availableModels, sessionId)`.
7. Validate plan only uses available model IDs.
8. Return frontend-compatible `Plan` object.

MVP plan generator can be deterministic first:

- Use classifier from Step 6.
- If no decomposition, create one subtask.
- If decomposition needed, create 3 to 5 subtasks.
- Select best model by strengths:
  - coding -> model with `coding`, otherwise first available
  - research/analysis -> model with `analysis` or `reasoning`
  - creative -> model with `writing` or `general`
  - math/logic -> model with `reasoning`
  - general -> cheapest/fastest available

Required response shape:

```json
{
  "planId": "uuid-or-timestamp-id",
  "prompt": "original prompt",
  "category": "coding",
  "difficulty": "medium",
  "needsDecomposition": false,
  "availableModels": ["gpt-4o-mini"],
  "subtasks": [
    {
      "id": 1,
      "title": "Answer the user request",
      "assignedModel": "gpt-4o-mini",
      "prompt": "original prompt",
      "estimatedTokens": 500,
      "estimatedCost": 0.001,
      "estimatedTime": 3
    }
  ],
  "totalEstimate": {
    "tokens": 500,
    "cost": 0.001,
    "timeSeconds": 3
  }
}
```

Validation:

```bash
curl -X POST http://localhost:8000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"session_id":"SESSION_ID","prompt":"Build a React todo app","available_models":["gpt-4o-mini"]}'
```

Confirm the frontend displays the plan card.

---

### Step 8 - Add plan validator

Inside `core/router.js`, add:

```js
validatePlanModels(plan, availableModelIds)
```

Rules:

- Every `subtask.assignedModel` must be in `availableModelIds`.
- Plan must have at least one subtask.
- Every subtask must have `id`, `title`, `assignedModel`, and `prompt`.
- Total estimates must be numeric.

If validation fails, return HTTP 500 or regenerate with deterministic fallback.

This protects against the highest-risk product issue: router assigning unavailable models.

---

### Step 9 - Implement provider model call adapters

Create or implement inside `core/executor.js`:

```js
callModel({ provider, modelId, apiKey, prompt })
callOpenAI(modelId, apiKey, prompt)
callAnthropic(modelId, apiKey, prompt)
callGemini(modelId, apiKey, prompt)
```

Return normalized shape:

```js
{
  output: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  latencyMs: number
}
```

Provider mapping comes from `model_registry.provider`.

MVP details:

- OpenAI: use Chat Completions or Responses API depending installed SDK version.
- Anthropic: use `messages.create`.
- Gemini: use `generateContent`.
- If SDK token usage is unavailable, estimate tokens using `estimateTokens()`.

---

### Step 10 - Implement `/api/execute`

Open:

- `routes/execute.js`
- `core/executor.js`

Request body from frontend:

```json
{
  "session_id": "...",
  "plan": { "planId": "...", "subtasks": [] }
}
```

Route responsibilities:

1. Validate `session_id` and `plan`.
2. Re-fetch available models from DB.
3. Validate plan models again.
4. Load encrypted keys for providers needed by the plan.
5. Decrypt key only when calling provider.
6. Execute subtasks sequentially for MVP.
7. On failure, fallback to another available model.
8. Capture tokens, cost, latency.
9. Add confidence score if helper exists, otherwise return a simple heuristic score.
10. Aggregate outputs into final answer.
11. Log analytics.
12. Return frontend-compatible `ExecutionResult`.

Required response shape:

```json
{
  "planId": "plan_123",
  "status": "completed",
  "subtaskResults": [
    {
      "id": 1,
      "title": "Answer the user request",
      "model": "gpt-4o-mini",
      "output": "...",
      "tokens": 600,
      "cost": 0.0012,
      "latencyMs": 1200,
      "usedFallback": false,
      "confidenceScore": 85,
      "confidenceNote": "Response appears complete and relevant."
    }
  ],
  "finalOutput": "merged markdown response",
  "analytics": {
    "totalTokens": 600,
    "totalCost": 0.0012,
    "totalTimeMs": 1200,
    "modelsUsed": ["gpt-4o-mini"]
  }
}
```

Validation:

- Click Approve in frontend.
- UI should replace executing message with result message.
- Details tab should show per-subtask output, confidence, tokens, cost, latency.

---

### Step 11 - Implement fallback model logic

Inside `core/executor.js`, add:

```js
getFallbackModels(failedModelId, availableModels, requiredProviderKeys)
```

Rules:

- Exclude failed model.
- Only include models with valid provider key.
- Prefer same category strengths if possible.
- Otherwise use cheapest available model.
- Log fallback reason.

For each subtask:

```text
try assigned model
if fails -> try fallback model 1
if fails -> try fallback model 2
if all fail -> mark subtask failed
```

Execution status rules:

- all subtasks succeeded -> `completed`
- at least one succeeded and one failed -> `partial`
- all failed -> `failed`

---

### Step 12 - Implement result aggregation

Add:

```js
aggregateResults(prompt, subtaskResults)
```

MVP aggregation:

- If one subtask, final output is that output.
- If multiple subtasks, join as markdown sections:

```md
# Final Response

## 1. Research
...

## 2. Implementation
...

## 3. Validation
...
```

Better version after MVP:

- Use cheapest available model to synthesize a polished final answer from all subtask outputs.

---

### Step 13 - Implement confidence scoring

MVP confidence score can be simple while M3 builds LLM scoring:

```js
score = 70
+ output length/relevance bonuses
- fallback penalty
- error penalty
```

Return:

```js
{
  score: 82,
  note: "Response is complete, relevant, and produced without fallback."
}
```

When M3 delivers LLM confidence scorer, replace heuristic with:

```js
scoreResponse(subtaskTitle, output, availableModels, sessionId)
```

---

### Step 14 - Implement analytics logging

Open:

- `db/analytics.js`
- `db/setup.sql`

Add tables if missing:

```sql
create table if not exists executions (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  plan_id text not null,
  prompt text not null,
  category text,
  difficulty text,
  status text not null,
  models_used text[] default '{}',
  total_tokens integer default 0,
  total_cost numeric(10,6) default 0,
  total_time_ms integer default 0,
  fallback_events jsonb default '[]'::jsonb,
  confidence_scores jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
```

Implement:

```js
logExecution({ sessionId, plan, result })
```

Call it at the end of `/api/execute`.

Validation:

- Run an execution.
- Query Supabase:

```sql
select plan_id, status, models_used, total_tokens, total_cost
from executions
order by created_at desc
limit 5;
```

---

### Step 15 - Add backend smoke tests

Create a simple smoke script, for example:

```text
backend/test_smoke.js
```

Test sequence:

1. `GET /health`
2. `POST /api/keys` with invalid key and confirm safe error shape
3. `GET /api/keys/models`
4. `POST /api/plan`
5. `POST /api/execute` if a real key exists

Also test pure functions without real keys:

- vault encrypt/decrypt
- classifier output
- token estimate
- plan validator rejects unavailable model

---

## 6. Priority Order for Your Work

If you are the backend engineer, do these in this exact order:

1. **Fix DB mismatch**: `user_id` -> `session_id`.
2. **Fix encryption**: replace plaintext vault.
3. **Verify key/model flow**: settings page should connect key and show models.
4. **Implement token/cost helper**.
5. **Implement classifier**.
6. **Implement deterministic `/api/plan`**.
7. **Validate frontend plan card works**.
8. **Implement model call adapters**.
9. **Implement `/api/execute` sequential execution**.
10. **Validate frontend approve/result flow works**.
11. **Add fallback retries**.
12. **Add analytics logging**.
13. **Add confidence scoring heuristic or M3 integration**.
14. **Optional: add SSE streaming**.
15. **Run end-to-end demo test and document known issues**.

---

## 7. Backend Done Criteria

Backend is demo-ready when all of these are true:

- `GET /health` works.
- `POST /api/keys` stores encrypted keys only.
- `GET /api/keys/models` returns valid available models.
- `POST /api/plan` returns a valid frontend-compatible plan.
- Plan never uses unavailable models.
- Frontend can display the plan.
- `POST /api/execute` runs at least one real LLM call server-side.
- Frontend can display final response.
- Execution result includes tokens, cost, latency, models used.
- Fallback is attempted when assigned model fails.
- Analytics row is saved after execution.
- No raw API keys appear in logs, responses, or database plaintext.

---

## 8. MVP vs Stretch Scope

### Must-have MVP

- Secure key storage with encryption.
- Available model list.
- Plan generation.
- Plan validation.
- Sequential execution.
- Fallback.
- Final merged output.
- Basic cost/token/latency analytics.

### Stretch after MVP works

- True Router LLM plan generation instead of deterministic plan builder.
- SSE streaming execution.
- React Flow live reasoning graph events.
- LLM-based final synthesis.
- LLM-based confidence scoring.
- User history endpoint.
- Spend caps.
- Provider key rotation/revocation UI.

---

## 9. Notes for Integration With Frontend

Do not change frontend response shapes unless M2 agrees. The frontend already imports these TypeScript interfaces from `app/lib/types.ts`:

- `ConnectedProvider`
- `AvailableModel`
- `Plan`
- `ExecutionResult`

The fastest path is to make backend exactly match those interfaces.

Current frontend API paths:

```text
GET  /health
POST /api/keys
GET  /api/keys/models?session_id=...
POST /api/plan
POST /api/execute
```

If backend adds new routes, keep these old ones working.

---

## 10. Immediate Next Coding Checklist

Use this checklist while implementing:

```text
[ ] routes/keys.js uses session_id, not user_id
[ ] security/vault.js uses AES-256-GCM
[ ] db/setup.sql has all needed tables
[ ] core/token_counter.js estimates tokens and cost
[ ] core/classifier.js classifies category/difficulty
[ ] core/router.js creates and validates plans
[ ] routes/plan.js calls router and returns Plan shape
[ ] core/executor.js calls OpenAI/Anthropic/Gemini
[ ] core/executor.js implements fallback
[ ] routes/execute.js returns ExecutionResult shape
[ ] db/analytics.js logs execution rows
[ ] smoke tests pass
[ ] frontend settings page shows connected models
[ ] frontend chat shows execution plan
[ ] frontend approve button returns final result
```
