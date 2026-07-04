# Backend Task Breakdown

BYO-LLM Orchestrator · M1 Role · 30-Hour Execution Plan

⚙️ M1 · Backend Engineer

Hour 0–1

Project Setup

Hour 1–3

API Key Vault

Hour 3–7

Router Brain

Hour 7–14

Execution Engine

Hour 14–17

Analytics + Fallback

Hour 17–20

Integration QA

Phase 1 Project Setup + Environment Configuration Hour 0 → 1

🏗️

Create project skeleton and install all SDKs

backend/ · venv · all packages in one shot

~30 min

1

Create project folder and Python virtual environment

Run these commands in order. Do not skip the venv — it isolates dependencies so nothing clashes during the hackathon.

bashterminal
    
    
    mkdir byo-llm-backend && cd byo-llm-backend
    python -m venv venv
    source venv/bin/activate        # Mac/Linux
    # venv\Scripts\activate        # Windows

2

Install all Python packages — do this in ONE command

Install everything now so you never get an ImportError mid-build. `tiktoken` is for token counting, `cryptography` is for AES key encryption.

bashterminal
    
    
    pip install fastapi uvicorn openai anthropic google-generativeai \
                supabase cryptography python-dotenv pydantic tiktoken

3

Create the exact folder structure — do NOT deviate from this

Every file path in this guide maps to this structure. M3 will write into core/token_counter.py and db/analytics.py — make sure those folders exist first.

bashterminal
    
    
    mkdir -p routes core security db
    touch main.py
    touch routes/keys.py routes/plan.py routes/execute.py
    touch core/router.py core/executor.py core/token_counter.py
    touch security/vault.py db/supabase.py db/analytics.py
    touch .env .gitignore

4

Create .env with all required variables

Get the Supabase URL and service key from your Supabase dashboard → Settings → API. The ENCRYPTION_KEY must be exactly 32 characters — it pads to AES-256.

env.env
    
    
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJhbGciOiJ...
    ENCRYPTION_KEY=hackathon_secret_key_32chars_xx   # exactly 32 chars
    PORT=8000

🔴 Add `.env` to `.gitignore` immediately. Never commit this file. NEVER. It contains your database credentials.

5

Write main.py — FastAPI entry point with CORS enabled

CORS must be enabled from the start or the frontend will get blocked. Wildcard origin is fine for a hackathon.

pythonmain.py
    
    
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from dotenv import load_dotenv
    load_dotenv()
    
    app = FastAPI(title="BYO-LLM Orchestrator")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],      # tighten for production, fine for hackathon
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    from routes.keys    import router as keys_router
    from routes.plan    import router as plan_router
    from routes.execute import router as exec_router
    
    app.include_router(keys_router)
    app.include_router(plan_router)
    app.include_router(exec_router)
    
    if __name__ == "__main__":
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

6

Write db/supabase.py — initialize client once, use everywhere

pythondb/supabase.py
    
    
    import os
    from supabase import create_client
    
    supabase_client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )
    # Import this in every file that needs DB access:
    # from db.supabase import supabase_client

7

Start the server and confirm it loads without errors

bashterminal
    
    
    uvicorn main:app --reload
    # Open browser: http://localhost:8000/docs
    # You should see the FastAPI Swagger UI — this means setup is working

✅

Phase 1 Checkpoint

□ Server starts without errors  
□ /docs loads in browser  
□ All folders and placeholder files exist  
□ .env is in .gitignore 

Phase 2 API Key Vault — Secure Encryption System Hour 1 → 3

⚠️ This is the foundation of the entire security model. Build this before anything else touches API keys. The core rule: **API keys NEVER leave the backend**. They go in encrypted, stay encrypted in DB, decrypt in-memory only milliseconds before an LLM call, and are never returned to the frontend.

🗄️

Create Supabase tables

api_keys table + Row Level Security

~20 min

1

Open Supabase dashboard → SQL Editor → run this SQL

This creates the table that stores encrypted API keys, keyed by session_id. The session_id is a UUID generated on the frontend per browser session — no login required.

sqlSupabase SQL Editor
    
    
    CREATE TABLE api_keys (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id    TEXT NOT NULL,
      provider      TEXT NOT NULL,   -- 'openai' | 'anthropic' | 'gemini'
      encrypted_key TEXT NOT NULL,   -- AES-256 encrypted, NEVER plain
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    
    ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
    
    -- Unique constraint: one key per provider per session
    CREATE UNIQUE INDEX api_keys_session_provider
      ON api_keys(session_id, provider);

2

Also create the executions table (coordinate with M3 — they may do this)

sqlSupabase SQL Editor
    
    
    CREATE TABLE executions (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id    TEXT NOT NULL,
      plan_id       TEXT,
      prompt        TEXT,
      category      TEXT,
      difficulty    TEXT,
      models_used   TEXT[],
      total_tokens  INT,
      total_cost    DECIMAL(10,6),
      total_time_ms INT,
      subtask_count INT,
      status        TEXT,
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

🔐

Write security/vault.py — AES-256 encrypt/decrypt

Fernet symmetric encryption · key from env var

~15 min

1

Write the vault module — this is the only file that handles raw keys

pythonsecurity/vault.py
    
    
    from cryptography.fernet import Fernet
    import base64, os
    
    def get_cipher():
        raw_key = os.getenv("ENCRYPTION_KEY").encode()
        # Fernet requires exactly 32 url-safe base64-encoded bytes
        padded = raw_key.ljust(32)[:32]
        key = base64.urlsafe_b64encode(padded)
        return Fernet(key)
    
    def encrypt_key(plain_text_api_key: str) -> str:
        # Call ONLY when saving to DB
        cipher = get_cipher()
        return cipher.encrypt(plain_text_api_key.encode()).decode()
    
    def decrypt_key(encrypted_api_key: str) -> str:
        # Call ONLY server-side, milliseconds before an LLM call
        # NEVER store the decrypted result. NEVER return it.
        cipher = get_cipher()
        return cipher.decrypt(encrypted_api_key.encode()).decode()

2

Quick test — run this to confirm encryption works before moving on

bashterminal
    
    
    python -c "
    from security.vault import encrypt_key, decrypt_key
    enc = encrypt_key('sk-test-1234')
    dec = decrypt_key(enc)
    print('Encrypted:', enc[:30], '...')
    print('Decrypted:', dec)
    print('Match:', dec == 'sk-test-1234')
    "

🔌

Write routes/keys.py — POST /api/keys + GET /api/models

Validate key → encrypt → store · return status only

~45 min

1

Write the key validation helper — tests that the key actually works before storing

This prevents storing dead keys. It makes a cheap API call (1 token) to confirm the key is valid and has credits. If it fails, return 400 immediately — don't store it.

pythonroutes/keys.py
    
    
    from fastapi import APIRouter
    from pydantic import BaseModel
    from security.vault import encrypt_key
    from db.supabase import supabase_client
    import openai, anthropic
    
    router = APIRouter()
    
    class KeySubmission(BaseModel):
        session_id: str
        provider: str     # "openai" | "anthropic" | "gemini"
        api_key: str
    
    async def validate_key(provider: str, key: str) -> bool:
        try:
            if provider == "openai":
                client = openai.OpenAI(api_key=key)
                client.models.list()   # cheap list call
            elif provider == "anthropic":
                client = anthropic.Anthropic(api_key=key)
                client.messages.create(
                    model="claude-haiku-20240307",
                    max_tokens=1,
                    messages=[{"role":"user","content":"hi"}]
                )
            elif provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=key)
                genai.list_models()
            return True
        except Exception:
            return False

2

Write POST /api/keys — the endpoint the frontend calls when user submits a key

Note the **upsert** : if user submits the same provider's key twice, it updates rather than duplicating rows.

pythonroutes/keys.py (continued)
    
    
    from fastapi.responses import JSONResponse
    
    @router.post("/api/keys")
    async def save_key(body: KeySubmission):
        # Step 1: Validate the key is real and has access
        is_valid = await validate_key(body.provider, body.api_key)
        if not is_valid:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid API key or insufficient credits"}
            )
    
        # Step 2: Encrypt before touching DB — NEVER store plain text
        encrypted = encrypt_key(body.api_key)
    
        # Step 3: Upsert — update if exists, insert if new
        supabase_client.table("api_keys").upsert({
            "session_id":   body.session_id,
            "provider":     body.provider,
            "encrypted_key": encrypted,
            "is_active":    True
        }, on_conflict="session_id,provider").execute()
    
        # Step 4: Return status — NEVER echo back the key
        return {"provider": body.provider, "status": "active"}

3

Write GET /api/models — returns list of connected models for the session

The frontend calls this after each key submission to refresh the "available models" list. This list is passed into every /api/plan request so the router only assigns models the user actually has keys for.

pythonroutes/keys.py (continued)

MODEL_MAP = { "openai": "gpt-4o", "anthropic": "claude-sonnet", "gemini": "gemini-flash" } @router.get("/api/models") async def get_available_models(session_id: str): rows = supabase_client.table("api_keys")\ .select("provider")\ .eq("session_id", session_id)\ .eq("is_active", True)\ .execute() available = [MODEL_MAP[row["provider"]] for row in rows.data] return {"availableModels": available} # Example: {"availableModels": ["gpt-4o", "claude-sonnet"]}

✅

Phase 2 Checkpoint — Tell M2 "keys API is live"

□ POST /api/keys with a real key → returns {"provider": "openai", "status": "active"}  
□ POST /api/keys with a bad key → returns 400 {"error": "Invalid API key"}  
□ GET /api/models?session_id=xxx → returns {"availableModels": ["gpt-4o"]}  
□ Supabase api_keys table has a row with encrypted_key (not plain text)  
□ No API key appears in any response body or server logs 

Phase 3 Router LLM Brain — The Core Intelligence Hour 3 → 7

💡 This is the smartest and most impressive part of the system. The Router receives the user's prompt + the list of available models, and outputs a complete execution plan as JSON. A well-crafted system prompt is everything here — spend time on it.

🧠

Write core/router.py — LLM routing logic

System prompt engineering · JSON plan output · model validation

~90 min

1

Write the ROUTER_SYSTEM_PROMPT — this is your most important string in the entire codebase

The system prompt IS the intelligence. The critical rule: the router must ONLY use models from the `availableModels` list passed to it. Use `response_format: json_object` to force valid JSON output — this saves you from parsing crashes.

pythoncore/router.py
    
    
    import json, openai, anthropic
    from security.vault import decrypt_key
    from db.supabase import supabase_client
    
    ROUTER_SYSTEM_PROMPT = """
    You are an AI orchestration router. Analyze the user prompt and generate
    an execution plan using ONLY the models in the availableModels list.
    
    CRITICAL: NEVER suggest a model not in availableModels. If unsure, assign
    to the first model in the list.
    
    Return ONLY valid JSON in this exact format, no markdown, no extra text:
    {
      "category": "research|coding|logic|creative|planning|math|data",
      "difficulty": "easy|medium|hard|agentic",
      "needsDecomposition": true or false,
      "reasoning": "one sentence explaining your routing decision",
      "subtasks": [
        {
          "id": 1,
          "title": "short task title",
          "assignedModel": "must match exactly from availableModels",
          "prompt": "the specific sub-prompt for this subtask"
        }
      ]
    }
    
    Model assignment rules (apply ONLY if the model is available):
    - Research, analysis, long reasoning → prefer claude-sonnet
    - Coding, technical output, structured data → prefer gpt-4o
    - Fast/simple tasks, summaries, formatting → prefer gemini-flash
    - If only 1 model is available, assign ALL subtasks to it.
    
    When to decompose (needsDecomposition = true):
    - Task has 3 or more clearly distinct areas of work
    - Task would benefit from different model specializations
    - Single-model tasks: needsDecomposition = false, 1 subtask only
    """

2

Write the helper that selects which model to use for routing itself

The router needs a model to call. Use the cheapest available model (gpt-4o-mini preferred). This function finds the right model and decrypts its key from the DB.

pythoncore/router.py (continued)

def model_to_provider(model: str) -> str: if "gpt" in model: return "openai" if "claude" in model: return "anthropic" if "gemini" in model: return "gemini" raise Exception(f"Unknown model: {model}") def get_router_model_and_key(available_models: list, session_id: str): # Prefer cheapest model for routing to save costs preference = ["gpt-4o", "claude-sonnet", "gemini-flash"] for model in preference: if model in available_models: provider = model_to_provider(model) row = supabase_client.table("api_keys")\ .select("encrypted_key")\ .eq("session_id", session_id)\ .eq("provider", provider)\ .single().execute() return model, decrypt_key(row.data["encrypted_key"]) raise Exception("No available model to route with")

3

Write the generate_plan() async function — main router entry point

After getting the plan from the LLM, always validate that every assigned model is actually in the available list. If the LLM hallucinated a model name, force-fix it to the first available model. This prevents execution failures.

pythoncore/router.py (continued)
    
    
    async def generate_plan(prompt: str, available_models: list, session_id: str) -> dict:
        router_model, router_key = get_router_model_and_key(available_models, session_id)
    
        user_message = f"""
    Available models: {available_models}
    
    User prompt: {prompt}
    
    Generate the execution plan. Use ONLY the available models listed above.
    """
    
        if "gpt" in router_model:
            client = openai.OpenAI(api_key=router_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",   # cheaper model for routing itself
                messages=[
                    {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message}
                ],
                response_format={"type": "json_object"}  # forces valid JSON
            )
            plan = json.loads(response.choices[0].message.content)
    
        elif "claude" in router_model:
            client = anthropic.Anthropic(api_key=router_key)
            response = client.messages.create(
                model="claude-haiku-20240307",  # cheapest claude for routing
                max_tokens=2000,
                system=ROUTER_SYSTEM_PROMPT + "\n\nReturn ONLY valid JSON, no markdown.",
                messages=[{"role": "user", "content": user_message}]
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences if Claude adds them
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("\n", 1)[0]
            plan = json.loads(raw)
    
        # CRITICAL: Validate — LLMs sometimes hallucinate model names
        for task in plan["subtasks"]:
            if task["assignedModel"] not in available_models:
                task["assignedModel"] = available_models[0]  # force-fix
    
        return plan

📋

Write routes/plan.py — POST /api/plan endpoint

Calls router · adds token estimates · returns full plan JSON

~40 min

1

Write the /api/plan endpoint — this is the endpoint M2's "Analyze" button calls

This endpoint: (1) calls generate_plan() to get the routing plan, (2) calls M3's token estimator on each subtask, (3) calculates totals, (4) returns the full plan JSON matching the agreed contract exactly.

pythonroutes/plan.py
    
    
    from fastapi import APIRouter
    from pydantic import BaseModel
    from core.router import generate_plan
    from core.token_counter import estimate_tokens_and_cost  # M3 writes this
    import uuid
    
    router = APIRouter()
    
    class PlanRequest(BaseModel):
        session_id: str
        prompt: str
        available_models: list[str]
    
    @router.post("/api/plan")
    async def create_plan(body: PlanRequest):
        plan_id = str(uuid.uuid4())
    
        # 1. Get routing plan from LLM
        plan = await generate_plan(
            prompt=body.prompt,
            available_models=body.available_models,
            session_id=body.session_id
        )
    
        # 2. Add token/cost estimates per subtask (M3 module)
        for task in plan["subtasks"]:
            estimates = estimate_tokens_and_cost(task["prompt"], task["assignedModel"])
            task["estimatedTokens"] = estimates["tokens"]
            task["estimatedCost"]   = estimates["cost"]
            task["estimatedTime"]   = estimates["timeSeconds"]
    
        # 3. Aggregate totals
        total_tokens = sum(t["estimatedTokens"] for t in plan["subtasks"])
        total_cost   = sum(t["estimatedCost"]   for t in plan["subtasks"])
        total_time   = sum(t["estimatedTime"]   for t in plan["subtasks"])
    
        return {
            "planId":            plan_id,
            "prompt":            body.prompt,
            "category":          plan["category"],
            "difficulty":        plan["difficulty"],
            "needsDecomposition": plan["needsDecomposition"],
            "availableModels":   body.available_models,
            "subtasks":          plan["subtasks"],
            "totalEstimate": {
                "tokens":      total_tokens,
                "cost":        round(total_cost, 4),
                "timeSeconds": total_time
            }
        }

📝 **Coordination point:** M3 writes `core/token_counter.py`. Stub it out with a placeholder first so your import doesn't crash: `def estimate_tokens_and_cost(p, m): return {"tokens":1000,"cost":0.01,"timeSeconds":10}` — replace with the real one when M3 delivers it.

✅

Phase 3 Checkpoint — THIS IS THE HOUR 9 MILESTONE. Tell M2: "Plan API is ready."

□ POST /api/plan returns valid JSON matching the contract format exactly  
□ Router ONLY assigns models from the available_models list  
□ estimatedTokens, estimatedCost, estimatedTime appear in each subtask  
□ totalEstimate.tokens / .cost / .timeSeconds are calculated correctly  
□ Test with: curl -X POST http://localhost:8000/api/plan -H "Content-Type: application/json" -d '{"session_id":"test","prompt":"Write a haiku","available_models":["gpt-4o"]}' 

Phase 4 Execution Engine — Run Each Subtask with Fallback Hour 7 → 14

⚡

Write core/executor.py — the execution engine

call_model() · execute_plan() · fallback logic · merge_outputs()

~3 hrs

1

Write call_model() — calls a specific model and returns output + actual stats

This function handles the actual LLM calls for each provider. It decrypts the key at the last possible moment, measures latency, and returns actual token usage (not estimates).

pythoncore/executor.py
    
    
    import time, openai, anthropic
    from security.vault import decrypt_key
    from db.supabase import supabase_client
    
    def model_to_provider(model: str) -> str:
        if "gpt"    in model: return "openai"
        if "claude" in model: return "anthropic"
        if "gemini" in model: return "gemini"
    
    async def call_model(model: str, prompt: str, session_id: str) -> dict:
        provider = model_to_provider(model)
    
        # Decrypt key in memory — never stored, lives for milliseconds
        row = supabase_client.table("api_keys")\
            .select("encrypted_key")\
            .eq("session_id", session_id)\
            .eq("provider", provider)\
            .single().execute()
        api_key = decrypt_key(row.data["encrypted_key"])
    
        start = time.time()
    
        if provider == "openai":
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}]
            )
            output = response.choices[0].message.content
            tokens = response.usage.total_tokens
            cost   = (response.usage.prompt_tokens / 1000 * 0.0025
                    + response.usage.completion_tokens / 1000 * 0.010)
    
        elif provider == "anthropic":
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )
            output = response.content[0].text
            tokens = response.usage.input_tokens + response.usage.output_tokens
            cost   = (response.usage.input_tokens  / 1000 * 0.003
                    + response.usage.output_tokens / 1000 * 0.015)
    
        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model_client = genai.GenerativeModel("gemini-1.5-flash")
            response = model_client.generate_content(prompt)
            output = response.text
            tokens = response.usage_metadata.total_token_count
            cost   = tokens / 1000 * 0.000075
    
        latency_ms = int((time.time() - start) * 1000)
        return {"output": output, "tokens": tokens,
                 "cost": round(cost, 6), "latencyMs": latency_ms}

2

Write execute_plan() — runs all subtasks with automatic fallback

The fallback logic is key: for each subtask, try the assigned model first. If it fails (API error, rate limit, bad key), automatically try the next available model. This is a huge reliability win and judges love seeing it.

pythoncore/executor.py (continued)
    
    
    async def execute_plan(plan: dict, session_id: str) -> dict:
        results = []
        available_models = plan["availableModels"]
    
        for task in plan["subtasks"]:
            result = None
    
            # Try assigned model first, then fall back through remaining models
            models_to_try = [task["assignedModel"]] + [
                m for m in available_models if m != task["assignedModel"]
            ]
    
            for model in models_to_try:
                try:
                    result = await call_model(model, task["prompt"], session_id)
                    result["model"]    = model
                    result["id"]       = task["id"]
                    result["title"]    = task["title"]
                    result["usedFallback"] = (model != task["assignedModel"])
                    break   # success — stop trying
                except Exception as e:
                    print(f"Model {model} failed on task {task['id']}: {e}. Trying fallback...")
                    continue
    
            if result:
                results.append(result)
            else:
                # All models failed for this task
                results.append({
                    "id": task["id"], "title": task["title"],
                    "model": "failed", "output": "Task failed — all models unavailable",
                    "tokens": 0, "cost": 0, "latencyMs": 0
                })
    
        final_output = merge_outputs(results)
        models_used  = list({r["model"] for r in results if r["model"] != "failed"})
        total_tokens = sum(r["tokens"] for r in results)
        total_cost   = sum(r["cost"]   for r in results)
        total_time   = sum(r["latencyMs"] for r in results)
    
        return {
            "subtaskResults": results,
            "finalOutput":    final_output,
            "analytics": {
                "totalTokens":  total_tokens,
                "totalCost":    round(total_cost, 6),
                "totalTimeMs":  total_time,
                "modelsUsed":   models_used
            }
        }
    
    def merge_outputs(results: list) -> str:
        """Combine subtask outputs into a single coherent response."""
        sections = []
        for r in results:
            sections.append(f"## {r['title']}\n\n{r['output']}")
        return "\n\n---\n\n".join(sections)

3

Wire in confidence scoring from M3 — add this ONE LINE after each subtask runs

M3 writes core/confidence.py. Once they hand it over, add this call right after result is populated in execute_plan().

pythoncore/executor.py — add after line "result['title'] = task['title']"

# Wire in M3's confidence scorer — do this when they deliver confidence.py from core.confidence import score_response confidence = await score_response( task["title"], result["output"], available_models, session_id ) result["confidenceScore"] = confidence["score"] result["confidenceNote"] = confidence["note"]

🔀

Write routes/execute.py — POST /api/execute endpoint

Runs plan · calls analytics logger · returns full result JSON

~45 min

1

Write the endpoint — receives plan_id + session_id, retrieves plan state, runs execution

Important design decision: the frontend sends the full plan object (not just the plan_id) to avoid a DB round-trip. This simplifies the implementation and reduces latency at demo time.

pythonroutes/execute.py
    
    
    from fastapi import APIRouter
    from pydantic import BaseModel
    from core.executor import execute_plan
    from db.analytics import log_execution   # M3 writes this
    
    router = APIRouter()
    
    class ExecuteRequest(BaseModel):
        session_id: str
        plan: dict        # the full plan object from /api/plan response
    
    @router.post("/api/execute")
    async def run_execution(body: ExecuteRequest):
        # Run all subtasks with fallback
        result = await execute_plan(body.plan, body.session_id)
    
        # Determine overall status
        failed_count = sum(1 for r in result["subtaskResults"]
                           if r["model"] == "failed")
        if failed_count == 0:
            status = "completed"
        elif failed_count < len(result["subtaskResults"]):
            status = "partial"
        else:
            status = "failed"
    
        result["planId"] = body.plan.get("planId")
        result["status"] = status
    
        # Log analytics to Supabase (M3 module)
        try:
            log_execution(body.plan, result, body.session_id)
        except Exception as e:
            print(f"Analytics log failed (non-critical): {e}")
    
        return result

✅

Phase 4 Checkpoint — Full execution pipeline working

□ POST /api/execute runs all subtasks and returns merged output  
□ Each subtask result has: model, output, actualTokens, actualCost, latencyMs  
□ analytics.totalTokens / .totalCost / .totalTimeMs / .modelsUsed all present  
□ Fallback test: disable one key in Supabase (set is_active=false), re-run → system still completes using other model  
□ status field correctly shows "completed" | "partial" | "failed" 

Phase 5 Integration: Wire in M3 Modules + Analytics Hour 14 → 17

🔗

Integrate M3's token counter, analytics logger, and confidence scorer

These are drop-in integrations — M3 delivers the files, you wire them in

~1.5 hrs

1

Stub out core/token_counter.py immediately (don't wait for M3)

Use this placeholder NOW so your plan route doesn't crash on import. Replace the body when M3 delivers the real module.

pythoncore/token_counter.py — STUB (replace with M3's version)

def estimate_tokens_and_cost(prompt: str, model: str) -> dict: # STUB — M3 will replace this with real tiktoken logic return {"tokens": 1000, "cost": 0.01, "timeSeconds": 10}

💡 When M3 delivers `core/token_counter.py`, just replace this file. The import in routes/plan.py stays identical — zero changes needed elsewhere.

2

Stub out db/analytics.py immediately

pythondb/analytics.py — STUB (replace with M3's version)

def log_execution(plan: dict, result: dict, session_id: str): # STUB — M3 will replace this with Supabase insert logic print("[stub] log_execution called")

3

Stub out core/confidence.py immediately

pythoncore/confidence.py — STUB (replace with M3's version)

async def score_response(task_title, response, available_models, session_id) -> dict: # STUB — M3 will replace this with LLM-based scoring return {"score": 85, "note": "Placeholder score"}

4

When M3 delivers the real files — drop them in and test

After M3 hands over their modules, run these quick tests to confirm each one works:

Token counter: `python -c "from core.token_counter import estimate_tokens_and_cost; print(estimate_tokens_and_cost('hello world this is a test', 'gpt-4o'))"`

Re-run POST /api/plan and confirm estimatedTokens are now real values (not 1000)

Run a full POST /api/execute and confirm the executions table in Supabase has a new row

Confirm confidenceScore and confidenceNote appear in each subtaskResult

Phase 6 End-to-End QA — Test Everything Before Demo Polish Hour 17 → 20

🧪

Run the 3 required test scenarios + full checklist

Simple · Complex · Fallback · Full verification

~2 hrs

1

Test Scenario 1: Simple — single model, no decomposition

Expected behavior: difficulty = "easy", needsDecomposition = false, exactly 1 subtask, fast result (under 5 seconds).

bashterminal
    
    
    # 1. Submit key
    curl -X POST http://localhost:8000/api/keys \
      -H "Content-Type: application/json" \
      -d '{"session_id":"test-001","provider":"openai","api_key":"sk-..."}'
    
    # 2. Get models
    curl "http://localhost:8000/api/models?session_id=test-001"
    
    # 3. Generate plan
    curl -X POST http://localhost:8000/api/plan \
      -H "Content-Type: application/json" \
      -d '{"session_id":"test-001","prompt":"Write a haiku about AI","available_models":["gpt-4o"]}'
    
    # 4. Execute plan (use planId + full plan object from step 3)
    curl -X POST http://localhost:8000/api/execute \
      -H "Content-Type: application/json" \
      -d '{"session_id":"test-001","plan":{...plan from step 3...}}'

2

Test Scenario 2: Complex — multi-model, decomposition (THE DEMO PROMPT)

Expected behavior: difficulty = "hard", needsDecomposition = true, 3+ subtasks, different models assigned to different subtasks. This is the exact prompt used in the live demo.

bashterminal
    
    
    # Run with both OpenAI and Anthropic keys connected
    curl -X POST http://localhost:8000/api/plan \
      -H "Content-Type: application/json" \
      -d '{
        "session_id":"test-002",
        "prompt":"Build a market research report for an AI travel startup",
        "available_models":["gpt-4o","claude-sonnet"]
      }'
    # Verify: 3+ subtasks, different assignedModel values
    # Verify: totalEstimate.cost around $0.03-0.05

3

Test Scenario 3: Fallback — disable a key, confirm system still completes

In Supabase SQL Editor, run: `UPDATE api_keys SET is_active = false WHERE provider = 'openai' AND session_id = 'test-002';` — then re-run the complex prompt. The system should still complete, using only claude-sonnet for all subtasks. Check that usedFallback = true appears in the relevant subtask results.

4

Full verification checklist — tick every box before moving to demo prep

POST /api/keys: valid key returns {status: "active"}, invalid key returns 400

GET /api/models returns only providers that are connected and active

POST /api/plan never returns a model not in the availableModels list

POST /api/plan: estimatedTokens, estimatedCost, estimatedTime populated in every subtask

POST /api/execute: all subtasks run, finalOutput is merged result

POST /api/execute: confidenceScore and confidenceNote present in each subtaskResult

Fallback: disable a key → system still completes with alternate model

executions table in Supabase has a new row after each /api/execute call

No API key appears in ANY response body, log line, or browser network tab

Frontend with USE_MOCK = false works end-to-end (coordinate flip with M2)

Demo prompt "Build a market research report for an AI travel startup" runs cleanly end-to-end

⚠️ **After Hour 20:** Your role shifts to support. M2 needs you available to flip USE_MOCK to false and debug any integration issues they hit. Keep your server running. Don't start new features after Hour 20 — stability only.

🏁

Final Backend Milestone — Hour 20

All 3 test scenarios pass · Full checklist ticked · Server is stable and running · M2 has switched to USE_MOCK = false · You're on standby for demo support 
