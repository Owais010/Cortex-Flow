📋 Team Contracts

⚙️ M1 · Backend

🖥️ M2 · Frontend

🔬 M3 · Integration

Hour 0 — Before Anyone Writes Code

Team Contracts & Shared Agreements

Every member must read this first. These are the agreed interfaces, data formats, and rules that prevent blockers between the three of you.

All Members Non-Negotiable Agree in Hour 0

C1

Agreed API Response Format — /api/plan

M1 must return this exact JSON shape. M2 will hardcode mock data in this format from Hour 0. When M1 is ready, M2 just swaps the mock for the real endpoint.

Hour 0

JSON/api/plan — Response Contract
    
    
    {
      "planId": "uuid-here",
      "prompt": "Build a market research report for an AI travel startup",
      "category": "research",                    // research | coding | logic | creative | planning | math
      "difficulty": "hard",                     // easy | medium | hard | agentic
      "needsDecomposition": true,
      "availableModels": ["gpt-4o", "claude-sonnet"],  // only what user connected
      "subtasks": [
        {
          "id": 1,
          "title": "Market research overview",
          "assignedModel": "claude-sonnet",
          "estimatedTokens": 3200,
          "estimatedCost": 0.012,
          "estimatedTime": 14         // seconds
        },
        {
          "id": 2,
          "title": "Competitor analysis",
          "assignedModel": "gpt-4o",
          "estimatedTokens": 2800,
          "estimatedCost": 0.028,
          "estimatedTime": 10
        }
      ],
      "totalEstimate": {
        "tokens": 6000,
        "cost": 0.04,
        "timeSeconds": 24
      }
    }

🚨 M2 hardcodes exactly this structure as mock data from Hour 0. M3 writes the cost fields into this same shape. Nobody deviates from this contract without telling the group first.

C2

Agreed API Response Format — /api/execute

What M1 returns after running all tasks. M2 renders this in the result dashboard.

Hour 0

JSON/api/execute — Response Contract
    
    
    {
      "planId": "uuid-here",
      "status": "completed",                  // completed | partial | failed
      "subtaskResults": [
        {
          "id": 1,
          "title": "Market research overview",
          "model": "claude-sonnet",
          "output": "...the actual response text...",
          "actualTokens": 3180,
          "actualCost": 0.011,
          "latencyMs": 12400,
          "confidenceScore": 87,          // 0-100, added by M3
          "confidenceNote": "Well-structured, cited sources"
        }
      ],
      "finalOutput": "...merged aggregated response...",
      "analytics": {
        "totalTokens": 5990,
        "totalCost": 0.038,
        "totalTimeMs": 22800,
        "modelsUsed": ["claude-sonnet", "gpt-4o"]
      }
    }

C3

Security Rules — API Keys

The single most important rule in the entire project.

Permanent

🔴

**RULE: API keys NEVER leave the backend server.**  
Frontend sends keys ONCE to POST /api/keys. Backend encrypts and stores. All LLM calls are made server-side. Frontend never sees a key again after submission. If M2 ever finds themselves holding an API key in the browser — something is wrong. 

Frontend: User types "sk-abc123" into form

↓ POST /api/keys (HTTPS only)

Backend: Receives key → AES-256 encrypt → Store in DB

↓ Returns: { provider: "openai", status: "active" } — NO key in response

Frontend: Shows green dot "OpenAI Connected"

↓ When executing:

Backend: Decrypts key in memory → Calls OpenAI → Returns result

Frontend NEVER touches the key again ✓

C4

M2 Mock Data Strategy — Work Without Waiting for M1

M2 must be able to build the full UI from Hour 0. Here is the mock data M2 uses until M1's API is ready.

Hours 0–9

JavaScriptM2: mockData.js — use this until M1 is ready
    
    
    // M2: Create this file. Use it everywhere until M1's API is live.
    // When M1 says "API is ready", just replace these with real fetch() calls.
    
    export const getMockPlan = () => ({
      planId: "mock-plan-001",
      prompt: "Build a market research report for an AI travel startup",
      category: "research",
      difficulty: "hard",
      needsDecomposition: true,
      availableModels: ["gpt-4o", "claude-sonnet"],
      subtasks: [
        { id: 1, title: "Market research overview",   assignedModel: "claude-sonnet", estimatedTokens: 3200, estimatedCost: 0.012, estimatedTime: 14 },
        { id: 2, title: "Competitor analysis",          assignedModel: "gpt-4o",       estimatedTokens: 2800, estimatedCost: 0.028, estimatedTime: 10 },
      ],
      totalEstimate: { tokens: 6000, cost: 0.04, timeSeconds: 24 }
    });
    
    export const getMockResult = () => ({
      planId: "mock-plan-001",
      status: "completed",
      subtaskResults: [
        { id: 1, title: "Market research overview", model: "claude-sonnet", output: "The AI travel market is projected to reach $1.2B by 2026...", actualTokens: 3180, actualCost: 0.011, latencyMs: 12400, confidenceScore: 87, confidenceNote: "Well-structured with cited data" },
        { id: 2, title: "Competitor analysis",      model: "gpt-4o",       output: "Key competitors: Hopper, Google Flights, Kayak...",         actualTokens: 2810, actualCost: 0.027, latencyMs: 9800,  confidenceScore: 82, confidenceNote: "Accurate but missing pricing data" },
      ],
      finalOutput: "## Market Research Report\n\nThe AI travel market...",
      analytics: { totalTokens: 5990, totalCost: 0.038, totalTimeMs: 22200, modelsUsed: ["claude-sonnet", "gpt-4o"] }
    });

Member 1 · Backend & Orchestration Engineer

Complete Step-by-Step Guide

You are the most critical person. Every other member depends on your endpoints being live. Build in the exact order shown. Do not skip ahead.

FastAPI / Node.js Python / JS Supabase OpenAI + Anthropic + Gemini SDKs

S1

Project Setup + Install All Dependencies

Get the project skeleton running with all SDKs installed and environment variables configured.

Hour 0–1

Create project and install packages

bashTerminal
    
    
    # Python (FastAPI) setup
    mkdir byo-llm-backend && cd byo-llm-backend
    python -m venv venv && source venv/bin/activate
    pip install fastapi uvicorn openai anthropic google-generativeai
    pip install supabase cryptography python-dotenv pydantic tiktoken
    
    # OR Node.js (Express) setup
    mkdir byo-llm-backend && cd byo-llm-backend
    npm init -y
    npm install express openai @anthropic-ai/sdk @google/generative-ai
    npm install @supabase/supabase-js dotenv crypto-js

Create .env file

env.env
    
    
    SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_KEY=your_service_key
    ENCRYPTION_KEY=your_32_char_secret_key_here_1234  # for AES-256
    PORT=8000

Create folder structure

textFile Structure
    
    
    backend/
    ├── main.py (or index.js)     # FastAPI app entry
    ├── routes/
    │   ├── keys.py               # POST /api/keys
    │   ├── plan.py               # POST /api/plan
    │   └── execute.py            # POST /api/execute
    ├── core/
    │   ├── classifier.py         # Prompt classification logic
    │   ├── router.py             # Router LLM brain
    │   ├── decomposer.py         # Task decomposition
    │   ├── executor.py           # Runs each subtask
    │   └── token_counter.py      # Token + cost estimation
    ├── security/
    │   └── vault.py              # Encrypt/decrypt API keys
    └── db/
        └── supabase.py           # DB connection

✅

Checkpoint — End of Step 1

Server starts without errors · All SDKs imported · .env loads · Folder structure created

S2

API Key Vault — Secure Encryption System

This is the foundation of the entire security model. Build this before anything else touches API keys.

Hour 1–3

Supabase table — create this in Supabase dashboard

SQLSupabase SQL Editor
    
    
    CREATE TABLE api_keys (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id  TEXT NOT NULL,               -- identifies the user session
      provider    TEXT NOT NULL,               -- 'openai' | 'anthropic' | 'gemini'
      encrypted_key TEXT NOT NULL,            -- AES encrypted, never plain text
      is_active   BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    
    -- Enable Row Level Security
    ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

security/vault.py — Core encrypt/decrypt logic

Pythonsecurity/vault.py
    
    
    from cryptography.fernet import Fernet
    import base64, os
    
    # Generate a consistent key from your ENCRYPTION_KEY env var
    def get_cipher():
        raw_key = os.getenv("ENCRYPTION_KEY").encode()
        # Fernet needs exactly 32 url-safe base64-encoded bytes
        padded = raw_key.ljust(32)[:32]
        key = base64.urlsafe_b64encode(padded)
        return Fernet(key)
    
    def encrypt_key(plain_text_api_key: str) -> str:
        cipher = get_cipher()
        encrypted = cipher.encrypt(plain_text_api_key.encode())
        return encrypted.decode()
    
    def decrypt_key(encrypted_api_key: str) -> str:
        cipher = get_cipher()
        decrypted = cipher.decrypt(encrypted_api_key.encode())
        return decrypted.decode()
    
    # USAGE RULE: encrypt_key() only on saving. decrypt_key() only server-side before LLM call.
    # decrypted key lives in memory for milliseconds, never stored or returned.

routes/keys.py — POST /api/keys endpoint

Pythonroutes/keys.py
    
    
    from fastapi import APIRouter
    from pydantic import BaseModel
    from security.vault import encrypt_key
    from db.supabase import supabase_client
    import openai, anthropic
    
    router = APIRouter()
    
    class KeySubmission(BaseModel):
        session_id: str
        provider: str    # "openai" | "anthropic" | "gemini"
        api_key: str
    
    async def validate_key(provider: str, key: str) -> bool:
        try:
            if provider == "openai":
                client = openai.OpenAI(api_key=key)
                client.models.list()   # cheap validation call
            elif provider == "anthropic":
                client = anthropic.Anthropic(api_key=key)
                client.messages.create(model="claude-haiku-20240307",
                    max_tokens=1, messages=[{"role":"user","content":"hi"}])
            return True
        except:
            return False
    
    @router.post("/api/keys")
    async def save_key(body: KeySubmission):
        # 1. Validate the key is real
        is_valid = await validate_key(body.provider, body.api_key)
        if not is_valid:
            return {"error": "Invalid API key"}, 400
    
        # 2. Encrypt before storing — NEVER store plain text
        encrypted = encrypt_key(body.api_key)
    
        # 3. Upsert into DB
        supabase_client.table("api_keys").upsert({
            "session_id": body.session_id,
            "provider": body.provider,
            "encrypted_key": encrypted,
            "is_active": True
        }).execute()
    
        # 4. Return status — NEVER return the key itself
        return { "provider": body.provider, "status": "active" }

GET /api/models — return which models are available

Pythonroutes/keys.py — add this
    
    
    @router.get("/api/models")
    async def get_available_models(session_id: str):
        rows = supabase_client.table("api_keys")\
            .select("provider")\
            .eq("session_id", session_id)\
            .eq("is_active", True)\
            .execute()
    
        # Map provider name to model name
        MODEL_MAP = {
            "openai": "gpt-4o",
            "anthropic": "claude-sonnet",
            "gemini": "gemini-flash"
        }
    
        available = [MODEL_MAP[row["provider"]] for row in rows.data]
        return { "availableModels": available }
        # Example return: { "availableModels": ["gpt-4o", "claude-sonnet"] }

✅

Checkpoint — End of Step 2

POST /api/keys works · Keys encrypted in Supabase · GET /api/models returns correct list · No plain keys ever in logs or responses

S3

Router LLM Brain — The Core Logic

This is the smartest part of your system. The Router receives the user's prompt + available models, and outputs a complete execution plan as JSON.

Hour 3–7

Core Router Logic — core/router.py

This function calls a small fast model (use GPT-4o-mini or Gemini Flash if available) with a carefully designed system prompt to analyze the user prompt and return a JSON plan.

Pythoncore/router.py
    
    
    import json, openai
    from security.vault import decrypt_key
    from db.supabase import supabase_client
    
    # The system prompt is the brain. Craft this carefully.
    ROUTER_SYSTEM_PROMPT = """
    You are an AI orchestration router. Your job is to analyze a user prompt
    and generate an execution plan using ONLY the available models listed.
    
    NEVER suggest a model not in the availableModels list.
    
    You must return ONLY valid JSON in this exact format:
    {
      "category": "research|coding|logic|creative|planning|math|data",
      "difficulty": "easy|medium|hard|agentic",
      "needsDecomposition": true|false,
      "reasoning": "one sentence explaining your decision",
      "subtasks": [
        {
          "id": 1,
          "title": "short task description",
          "assignedModel": "must be from availableModels only",
          "prompt": "the specific sub-prompt for this task"
        }
      ]
    }
    
    Model assignment rules (use ONLY if available):
    - Research, long reasoning, document analysis → prefer claude-sonnet
    - Coding, technical, structured output → prefer gpt-4o
    - Fast simple tasks, summaries → prefer gemini-flash
    - If only 1 model available, assign all tasks to it.
    - needsDecomposition = true only if task has 3+ distinct areas of work.
    """
    
    async def generate_plan(prompt: str, available_models: list, session_id: str) -> dict:
        # Get the routing model key — prefer gpt-4o-mini (cheapest for routing)
        router_model, router_key = get_router_model_and_key(available_models, session_id)
    
        user_message = f"""
    Available models: {available_models}
    
    User prompt: {prompt}
    
    Generate the execution plan using ONLY the available models above.
    """
    
        if "gpt" in router_model:
            client = openai.OpenAI(api_key=router_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message}
                ],
                response_format={"type": "json_object"}  # forces JSON output
            )
            plan = json.loads(response.choices[0].message.content)
    
        # VALIDATE: ensure all assigned models are in available_models
        for task in plan["subtasks"]:
            if task["assignedModel"] not in available_models:
                # Force-fix: assign first available model
                task["assignedModel"] = available_models[0]
    
        return plan
    
    def get_router_model_and_key(available_models, session_id):
        # Use cheapest available model for routing itself
        preference = ["gpt-4o", "claude-sonnet", "gemini-flash"]
        for model in preference:
            if model in available_models:
                provider = {"gpt-4o":"openai", "claude-sonnet":"anthropic", "gemini-flash":"gemini"}[model]
                row = supabase_client.table("api_keys").select("encrypted_key")\
                    .eq("session_id", session_id).eq("provider", provider).single().execute()
                return model, decrypt_key(row.data["encrypted_key"])
        raise Exception("No available model to route with")

💡 The **response_format: json_object** parameter forces GPT to always return valid JSON. For Claude, add "Return only valid JSON, no markdown" at the end of the system prompt. This saves you from JSON parsing errors.

routes/plan.py — POST /api/plan endpoint

Pythonroutes/plan.py
    
    
    from fastapi import APIRouter
    from pydantic import BaseModel
    from core.router import generate_plan
    from core.token_counter import estimate_tokens_and_cost
    import uuid
    
    router = APIRouter()
    
    class PlanRequest(BaseModel):
        session_id: str
        prompt: str
        available_models: list[str]  # sent by frontend from GET /api/models
    
    @router.post("/api/plan")
    async def create_plan(body: PlanRequest):
        plan_id = str(uuid.uuid4())
    
        # 1. Generate routing plan from LLM
        plan = await generate_plan(
            prompt=body.prompt,
            available_models=body.available_models,
            session_id=body.session_id
        )
    
        # 2. Add token + cost estimates per subtask (M3's module)
        for task in plan["subtasks"]:
            estimates = estimate_tokens_and_cost(task["prompt"], task["assignedModel"])
            task["estimatedTokens"] = estimates["tokens"]
            task["estimatedCost"]   = estimates["cost"]
            task["estimatedTime"]   = estimates["timeSeconds"]
    
        # 3. Calculate totals
        total_tokens = sum(t["estimatedTokens"] for t in plan["subtasks"])
        total_cost   = sum(t["estimatedCost"]   for t in plan["subtasks"])
        total_time   = sum(t["estimatedTime"]   for t in plan["subtasks"])
    
        return {
            "planId": plan_id,
            "prompt": body.prompt,
            "category": plan["category"],
            "difficulty": plan["difficulty"],
            "needsDecomposition": plan["needsDecomposition"],
            "availableModels": body.available_models,
            "subtasks": plan["subtasks"],
            "totalEstimate": { "tokens": total_tokens, "cost": total_cost, "timeSeconds": total_time }
        }

✅

Checkpoint — End of Step 3 (THIS IS THE HOUR 9 MILESTONE)

POST /api/plan returns valid JSON · Router only uses models from available list · Token/cost fields populated · Tell M2: "API is ready, plug it in"

S4

Execution Engine — Run Each Subtask Against Assigned Model

Once the user approves the plan, this engine runs each subtask sequentially, handles failures with fallback, and merges all outputs.

Hour 7–14

core/executor.py — The execution engine

Pythoncore/executor.py
    
    
    import time, openai, anthropic
    from security.vault import decrypt_key
    from db.supabase import supabase_client
    
    async def call_model(model: str, prompt: str, session_id: str) -> dict:
        """Call a specific model. Returns output, actual tokens, latency."""
        provider = model_to_provider(model)
    
        # Get and decrypt API key — exists in memory for milliseconds only
        row = supabase_client.table("api_keys").select("encrypted_key")\
            .eq("session_id", session_id).eq("provider", provider).single().execute()
        api_key = decrypt_key(row.data["encrypted_key"])
    
        start = time.time()
    
        if provider == "openai":
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role":"user", "content": prompt}]
            )
            output = response.choices[0].message.content
            tokens = response.usage.total_tokens
    
        elif provider == "anthropic":
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=4096,
                messages=[{"role":"user", "content": prompt}]
            )
            output = response.content[0].text
            tokens = response.usage.input_tokens + response.usage.output_tokens
    
        latency_ms = int((time.time() - start) * 1000)
        return { "output": output, "tokens": tokens, "latencyMs": latency_ms }
    
    async def execute_plan(plan: dict, session_id: str) -> dict:
        """Execute all subtasks. Fallback to next available model on failure."""
        results = []
        available_models = plan["availableModels"]
    
        for task in plan["subtasks"]:
            result = None
            models_to_try = [task["assignedModel"]] + [m for m in available_models if m != task["assignedModel"]]
    
            for model in models_to_try:  # try assigned first, fallback to others
                try:
                    result = await call_model(model, task["prompt"], session_id)
                    result["model"] = model
                    result["id"] = task["id"]
                    result["title"] = task["title"]
                    break  # success — stop trying
                except Exception as e:
                    # Log failure, try next model
                    print(f"Model {model} failed: {e}. Trying fallback...")
                    continue
    
            if result:
                results.append(result)
    
        # Merge all outputs into final response
        final_output = merge_outputs(results)
        return { "subtaskResults": results, "finalOutput": final_output }
    
    def merge_outputs(results: list) -> str:
        """Combine subtask outputs into a coherent final response."""
        sections = []
        for r in results:
            sections.append(f"## {r['title']}\n{r['output']}")
        return "\n\n---\n\n".join(sections)
    
    def model_to_provider(model: str) -> str:
        if "gpt" in model: return "openai"
        if "claude" in model: return "anthropic"
        if "gemini" in model: return "gemini"

✅

Checkpoint — End of Step 4

POST /api/execute runs all subtasks · Fallback works (disable one key and test) · Final merged output returned · Analytics data (tokens, cost, latency) present in response

Member 2 · Frontend & Visualization Engineer

Complete Step-by-Step Guide

You own the demo experience. Judges will judge this product by what they see. Build with mock data from Hour 0 — don't wait for M1. Use the contracts from the Team Contracts tab.

Next.js 14 Tailwind CSS React Flow Framer Motion

S1

Project Setup + Install + API Service Layer

Get Next.js running, install dependencies, and create the API service file that switches between mock and real data.

Hour 0–1

Create Next.js project and install packages

bashTerminal
    
    
    npx create-next-app@latest byo-llm-frontend --typescript --tailwind --app
    cd byo-llm-frontend
    npm install reactflow framer-motion uuid
    npm install @radix-ui/react-dialog lucide-react

Create services/api.ts — THE MOST IMPORTANT FILE for M2

This file switches between mock data and real API. Until M1 says "API ready", USE_MOCK = true. When M1 is ready, flip it to false.

TypeScriptservices/api.ts
    
    
    import { getMockPlan, getMockResult } from './mockData';
    
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const USE_MOCK = true;  // ← FLIP TO false WHEN M1 IS READY
    
    export async function submitApiKey(provider: string, apiKey: string, sessionId: string) {
      if (USE_MOCK) return { provider, status: 'active' };
      const res = await fetch(`${API_BASE}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, provider, api_key: apiKey })
      });
      return res.json();
    }
    
    export async function getAvailableModels(sessionId: string): Promise<string[]> {
      if (USE_MOCK) return ['gpt-4o', 'claude-sonnet'];
      const res = await fetch(`${API_BASE}/api/models?session_id=${sessionId}`);
      const data = await res.json();
      return data.availableModels;
    }
    
    export async function generatePlan(prompt: string, availableModels: string[], sessionId: string) {
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1800));  // simulate loading
        return getMockPlan();
      }
      const res = await fetch(`${API_BASE}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, prompt, available_models: availableModels })
      });
      return res.json();
    }
    
    export async function executePlan(planId: string, sessionId: string) {
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 3000));  // simulate execution time
        return getMockResult();
      }
      const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, session_id: sessionId })
      });
      return res.json();
    }

S2

Screen 1 — API Key Connection Page

The first screen users see. They connect their LLM providers. Shows active/inactive status per provider.

Hour 1–3

What this screen must do

Show 3 provider cards: OpenAI · Anthropic · Gemini

↓ Each card has:

Password input for API key

"Connect" button

Status dot: grey = not connected · green = active · red = invalid

↓ On "Connect" click:

Call submitApiKey() → show loading spinner → update status dot

↓ "Continue" button unlocks ONLY when at least 1 provider is connected

Navigate to prompt screen with sessionId + availableModels in state

Key UI details that impress judges

• Show provider logos (OpenAI, Anthropic, Google icons)  
• Mask the key input (type="password")  
• After connecting, show "GPT-4o ✓ Connected" with a green badge — never show the key itself  
• Animate the status dot from grey → loading spinner → green  
• Show "2/3 providers connected" as a progress indicator 

S3

Screen 2 — Prompt Input + Execution Plan Preview

The user types their prompt, the system analyzes it and shows a full execution plan BEFORE running. This is the most impressive screen for judges.

Hour 3–6

Screen flow

Large text area: "What do you want to build?"

↓ User clicks "Analyze"

Loading state: "Analyzing prompt..." with animated dots

↓ generatePlan() returns

Show PLAN PREVIEW CARD

Category badge: "Research" / "Coding" etc

Difficulty badge: "Hard" in red

Subtask list — each with model badge (GPT / Claude)

Total estimate: "~$0.04 · ~6k tokens · ~24 sec"

↓ Two buttons:

✅ Approve & Execute

✏️ Modify Plan

Plan Preview Card — core JSX structure

TSXcomponents/PlanPreview.tsx (structure)
    
    
    export function PlanPreview({ plan, onApprove, onModify }) {
      return (
        <div className="plan-card">
          {/* Header */}
          <div className="plan-header">
            <Badge color={categoryColor(plan.category)}>{plan.category}</Badge>
            <Badge color={difficultyColor(plan.difficulty)}>{plan.difficulty}</Badge>
            {plan.needsDecomposition && <Badge color="purple">Decomposed</Badge>}
          </div>
    
          {/* Subtask list */}
          <div className="subtasks">
            {plan.subtasks.map(task => (
              <div key={task.id} className="subtask-row">
                <span className="task-num">{task.id}</span>
                <span className="task-title">{task.title}</span>
                {/* Model badge - color depends on which model */}
                <ModelBadge model={task.assignedModel} />
                <span className="task-cost">~${task.estimatedCost}</span>
              </div>
            ))}
          </div>
    
          {/* Totals */}
          <div className="plan-totals">
            <TotalItem icon="💰" label="Estimated Cost"  value={`$${plan.totalEstimate.cost}`} />
            <TotalItem icon="🔤" label="Est. Tokens"     value={`${plan.totalEstimate.tokens.toLocaleString()}`} />
            <TotalItem icon="⏱️" label="Est. Time"       value={`~${plan.totalEstimate.timeSeconds}s`} />
          </div>
    
          {/* Action buttons */}
          <div className="plan-actions">
            <button onClick={onApprove} className="btn-approve">✅ Approve & Execute</button>
            <button onClick={onModify}  className="btn-modify">✏️ Modify</button>
          </div>
        </div>
      );
    }

S4

Reasoning Graph — React Flow Visualization

The SHOWSTOPPER feature. An animated graph that shows the entire orchestration flow visually. Judges will remember this.

Hour 6–10

How to build the React Flow graph from the plan data

TypeScriptcomponents/ReasoningGraph.tsx
    
    
    import ReactFlow, { Background, Controls } from 'reactflow';
    import 'reactflow/dist/style.css';
    
    // Convert plan JSON → ReactFlow nodes + edges
    function planToGraph(plan) {
      const nodes = [];
      const edges = [];
    
      // Node 1: User Prompt (top)
      nodes.push({ id: 'prompt', position: { x: 300, y: 0 },
        data: { label: '📝 User Prompt' }, type: 'input',
        style: { background: '#1a1a30', border: '1px solid #a78bfa', color: '#e2e2f5' }
      });
    
      // Node 2: Router Analysis
      nodes.push({ id: 'router', position: { x: 260, y: 100 },
        data: { label: `🧠 Router · ${plan.category} · ${plan.difficulty}` },
        style: { background: '#1a1a30', border: '1px solid #fbbf24', color: '#fbbf24' }
      });
      edges.push({ id: 'e1', source: 'prompt', target: 'router', animated: true });
    
      // Nodes for each subtask
      plan.subtasks.forEach((task, i) => {
        const taskId = `task-${task.id}`;
        const xPos = (i - plan.subtasks.length/2) * 200 + 300;
        nodes.push({ id: taskId, position: { x: xPos, y: 220 },
          data: { label: `${task.title}` },
          style: { background: '#0d0d1a', border: '1px solid #2dd4bf', color: '#2dd4bf', fontSize: '11px' }
        });
        edges.push({ id: `e-r-${task.id}`, source: 'router', target: taskId, animated: true });
    
        // Node for assigned model
        const modelId = `model-${task.id}`;
        const modelColor = task.assignedModel.includes('gpt') ? '#34d399' : '#f87171';
        nodes.push({ id: modelId, position: { x: xPos, y: 340 },
          data: { label: `🤖 ${task.assignedModel}` },
          style: { background: '#0d0d1a', border: `1px solid ${modelColor}`, color: modelColor, fontSize: '11px' }
        });
        edges.push({ id: `e-t-${task.id}`, source: taskId, target: modelId });
      });
    
      // Final output node
      nodes.push({ id: 'output', position: { x: 300, y: 460 },
        data: { label: '📄 Final Output' }, type: 'output',
        style: { background: '#1a1a30', border: '1px solid #60a5fa', color: '#60a5fa' }
      });
      plan.subtasks.forEach(task =>
        edges.push({ id: `e-out-${task.id}`, source: `model-${task.id}`, target: 'output' })
      );
    
      return { nodes, edges };
    }
    
    export function ReasoningGraph({ plan }) {
      const { nodes, edges } = planToGraph(plan);
      return (
        <div style={{ height: '500px', background: '#06060f', borderRadius: '12px' }}>
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background color="#1a1a30" />
            <Controls />
          </ReactFlow>
        </div>
      );
    }

S5

Screen 3 — Live Execution + Result Dashboard

After user approves, show real-time execution progress, then the final result with full analytics.

Hour 10–15

Execution state machine — use this in your React state

TypeScriptState flow for execution screen
    
    
    type AppState = {
      screen: 'connect' | 'prompt' | 'plan' | 'executing' | 'result';
      sessionId: string;
      availableModels: string[];
      plan: Plan | null;
      result: ExecutionResult | null;
      isLoading: boolean;
    }
    
    // Transitions:
    // connect  → prompt      (at least 1 model connected)
    // prompt   → plan        (after Analyze clicked + plan returned)
    // plan     → executing   (after user clicks Approve)
    // executing→ result      (after executePlan() returns)

Result dashboard — what to show

• Final merged text output (markdown rendered)  
• Per-subtask result cards: model used, confidence score badge, actual tokens/cost  
• Analytics bar: Total Cost | Total Tokens | Total Time | Models Used  
• Graph: update node colors to green = completed (animate this!)  
• "Run Again" and "New Prompt" buttons 

✅

M2 Checkpoint — Hour 15

All 3 screens work end-to-end with mock data · React Flow graph renders · Plan preview shows · Result dashboard shows · USE_MOCK flip to false works with M1 API

Member 3 · Integration, Data & QA Engineer

Complete Step-by-Step Guide

You are the glue. Your token/cost module plugs into M1's plan generator. Your confidence scorer runs after each execution. Your E2E tests catch the bugs before the demo does.

Python Logic Supabase Testing Pitch Deck

S1

Token + Cost Estimation Module

M1 will call this module inside /api/plan. Given a prompt and model name, return estimated tokens and cost before execution.

Hour 0–3

Pricing table — current rates (May 2025)

Model| Input (per 1k tokens)| Output (per 1k tokens)| Avg speed  
---|---|---|---  
gpt-4o| $0.0025| $0.01| ~40 tok/sec  
gpt-4o-mini| $0.00015| $0.0006| ~80 tok/sec  
claude-sonnet-4-5| $0.003| $0.015| ~50 tok/sec  
gemini-1.5-flash| $0.000075| $0.0003| ~100 tok/sec  
  
core/token_counter.py — The module M1 imports

Pythoncore/token_counter.py
    
    
    import tiktoken
    
    # Pricing per 1,000 tokens (as of mid-2025)
    PRICING = {
        "gpt-4o":           { "input": 0.0025,  "output": 0.010,  "speed": 40 },
        "gpt-4o-mini":      { "input": 0.00015, "output": 0.0006, "speed": 80 },
        "claude-sonnet":    { "input": 0.003,   "output": 0.015,  "speed": 50 },
        "gemini-flash":     { "input": 0.000075,"output": 0.0003, "speed": 100},
    }
    
    def count_tokens(text: str) -> int:
        "Count tokens using tiktoken (works for all models approximately)"
        try:
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(text))
        except:
            # Fallback: rough estimate (1 token ≈ 4 chars)
            return len(text) // 4
    
    def estimate_tokens_and_cost(prompt: str, model: str) -> dict:
        "Given prompt text and model, return estimated tokens, cost, time."
        input_tokens = count_tokens(prompt)
    
        # Assume output will be ~2x input tokens (typical for detailed tasks)
        output_tokens = input_tokens * 2
        total_tokens = input_tokens + output_tokens
    
        pricing = PRICING.get(model, PRICING["gpt-4o"])
    
        cost = (input_tokens  / 1000 * pricing["input"] +
                output_tokens / 1000 * pricing["output"])
    
        # Time = output tokens / tokens-per-second
        time_seconds = round(output_tokens / pricing["speed"])
    
        return {
            "tokens": total_tokens,
            "cost": round(cost, 4),
            "timeSeconds": max(time_seconds, 3)  # minimum 3 sec
        }

💡 Tell M1: "Import estimate_tokens_and_cost from core.token_counter in your /api/plan route." That's the only line M1 needs to add to use your module.

✅

Checkpoint — End of Step 1

Module works standalone (test it with python -c "from core.token_counter import estimate_tokens_and_cost; print(estimate_tokens_and_cost('hello world', 'gpt-4o'))") · M1 imports it successfully

S2

Supabase Setup + Analytics Logging

Create the database schema and the logging function M1 calls after each execution.

Hour 2–4

Create this SQL in Supabase dashboard

SQLSupabase SQL Editor — run this
    
    
    -- Already created by M1:
    -- CREATE TABLE api_keys ...
    
    -- M3 creates this:
    CREATE TABLE executions (
      id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id     TEXT NOT NULL,
      plan_id        TEXT,
      prompt         TEXT,
      category       TEXT,
      difficulty     TEXT,
      models_used    TEXT[],             -- array: ["gpt-4o", "claude-sonnet"]
      total_tokens   INT,
      total_cost     DECIMAL(10,6),
      total_time_ms  INT,
      subtask_count  INT,
      status         TEXT,              -- completed | partial | failed
      created_at     TIMESTAMPTZ DEFAULT now()
    );
    
    ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

db/analytics.py — M1 calls this after /api/execute

Pythondb/analytics.py
    
    
    from db.supabase import supabase_client
    
    def log_execution(plan: dict, result: dict, session_id: str):
        "Call this after every successful execution. Saves stats to DB."
        analytics = result.get("analytics", {})
        models_used = list({r["model"] for r in result.get("subtaskResults", [])})
    
        supabase_client.table("executions").insert({
            "session_id":    session_id,
            "plan_id":       plan.get("planId"),
            "prompt":        plan.get("prompt"),
            "category":      plan.get("category"),
            "difficulty":    plan.get("difficulty"),
            "models_used":   models_used,
            "total_tokens":  analytics.get("totalTokens"),
            "total_cost":    analytics.get("totalCost"),
            "total_time_ms": analytics.get("totalTimeMs"),
            "subtask_count": len(plan.get("subtasks", [])),
            "status":        result.get("status")
        }).execute()
        print("✅ Execution logged to analytics")

S3

Confidence Scoring Module

After each subtask runs, score the response quality with a quick LLM call. This makes the results panel much more impressive.

Hour 4–7

core/confidence.py — add scores to each result

Pythoncore/confidence.py

import json, openai from security.vault import decrypt_key CONFIDENCE_PROMPT = """ You are a response quality evaluator. Given a task and its AI-generated response, score the quality. Return ONLY JSON: {"score": 0-100, "note": "one short sentence explaining the score"} Score guidelines: \- 90-100: Comprehensive, accurate, well-structured \- 70-89: Good but missing some depth or details \- 50-69: Adequate but shallow or partially off-topic \- Below 50: Poor quality or wrong """ async def score_response(task_title: str, response: str, available_models: list, session_id: str) -> dict: # Use cheapest model for scoring (gpt-4o-mini or claude-haiku if available) scorer_model = available_models[0] # just use first available provider = model_to_provider(scorer_model) row = supabase_client.table("api_keys").select("encrypted_key")\ .eq("session_id", session_id).eq("provider", provider).single().execute() api_key = decrypt_key(row.data["encrypted_key"]) user_msg = f"Task: {task_title}\n\nResponse:\n{response[:1000]}" # truncate to save tokens client = openai.OpenAI(api_key=api_key) result = client.chat.completions.create( model="gpt-4o-mini", messages=[ {"role": "system", "content": CONFIDENCE_PROMPT}, {"role": "user", "content": user_msg} ], response_format={"type": "json_object"} ) return json.loads(result.choices[0].message.content) # Returns: {"score": 87, "note": "Well-structured with cited data"}

⚠️ Tell M1: "In executor.py, after getting each subtask result, call score_response() and add the score to the result dict." One line: `score = await score_response(task["title"], result["output"], available_models, session_id)`

S4

End-to-End Testing Checklist

Run this checklist at Hour 20 to verify the full system works before demo polish begins.

Hour 20–22

Test with these 3 exact scenarios

Test| Prompt| Expected Behavior  
---|---|---  
Simple / 1 model only| "Write a haiku about AI"| Easy difficulty, no decomposition, 1 model, fast result  
Complex / 2+ models| "Build a market research report for an AI travel startup"| Hard difficulty, decomposed 3+ subtasks, different models assigned  
Fallback test| Disable one API key, re-run complex prompt| Failed model triggers fallback, system still completes  
  
Full verification checklist

□ Key submission encrypts and stores correctly  
□ GET /api/models returns only connected providers  
□ POST /api/plan never returns a model not in availableModels  
□ Cost estimates appear in plan response  
□ POST /api/execute runs all subtasks and returns merged output  
□ Fallback: disable a key → system uses alternate model  
□ Confidence scores appear in each subtask result  
□ Analytics logged to Supabase executions table  
□ Frontend: all 3 screens work with real API (USE_MOCK = false)  
□ Reasoning graph renders correctly for both simple and complex prompts  
□ No API keys visible in browser network tab  
□ Demo prompt "Build a market research report" works end-to-end cleanly 

S5

Pitch Deck + Demo Script

5 slides only. Practice the demo script 3 times before presentation.

Hour 22–26

5-Slide Pitch Structure

Slide 1 — PROBLEM: "Most teams send everything to one LLM. That's slow, expensive, and suboptimal. GPT is not always the best tool for every task."

↓

Slide 2 — SOLUTION: "BYO-LLM Orchestrator. Connect your own API keys. Our router intelligently distributes tasks ONLY across models you own."

↓

Slide 3 — ARCHITECTURE: Show the flowchart diagram (use the one from your planning doc)

↓

Slide 4 — LIVE DEMO: Switch to app. Run "Build a market research report for an AI travel startup". Walk through: key connection → analyze → plan preview → approve → graph → result

↓

Slide 5 — VISION: "This becomes an enterprise AI gateway. Any team, any stack, any models. Intelligent orchestration as infrastructure."

Demo script (memorize this for the live demo)

textDemo Walkthrough Script (2 minutes)
    
    
    "Let me show you exactly how it works."
    
    [Screen: Key Connection page]
    "First, the user connects their own LLM API keys — OpenAI and Claude here."
    "Notice: once connected, the key is gone from the UI. It lives only on our server, encrypted."
    
    [Screen: Prompt input]
    "Now I type a complex prompt: 'Build a market research report for an AI travel startup'"
    [Click Analyze]
    
    [Screen: Plan Preview appears]
    "Before anything runs, our router LLM analyzes the task."
    "It classified this as Research, Hard difficulty."
    "It decomposed it into 3 subtasks."
    "Notice — Claude is assigned to the reasoning-heavy task, GPT to the structured analysis."
    "And here's the cost estimate: about 4 cents, 24 seconds."
    [Click Approve]
    
    [Screen: Execution + Graph animating]
    "Now watch the reasoning graph — each node lights up as tasks complete in real time."
    "This is live. Claude is running right now."
    
    [Screen: Result]
    "And here's the final output — merged from both models."
    "Each subtask has a confidence score. Claude scored 89%, GPT scored 82%."
    "Total cost: $0.038. Just under our estimate."
    
    "That's BYO-LLM Orchestration. Your models, intelligently routed."

✅

Final Checkpoint — Hour 27

Demo script rehearsed × 3 with full team · Backup cached results ready if API fails · All team members know their role during live presentation · Pitch deck exported as PDF backup
