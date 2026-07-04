⚡ 30-Hour Hackathon · 3-Person Team · Updated Architecture

# BYO-LLM Orchestration  
Battle Plan V2

Intelligent Multi-Model AI Orchestration · Bring Your Own LLM · Dynamic Routing

14 Features 3 Team Members 7 Phases · 30hrs

🧠 Updated System Flow

BYO-LLM Core Pipeline

User Adds  
API Keys

→

API Vault  
(Encrypted)

→

Detect  
Available Models

→

Router LLM  
Analysis

→

Execution  
Plan Generated

→

User  
Approves

→

Execute via  
Avail. Models Only

→

Stream  
Live Output

→

Analytics +  
Final Response

🔑 KEY RULE: Router ONLY routes to models whose API keys are connected. Never recommends unavailable models. 

📊 Feature Difficulty Analysis

01

API Key Vault (Secure Storage)

Encrypted store for user's OpenAI / Claude / Gemini keys. Never exposed to frontend.

Medium 2–3 hrs

02

Available Model Registry

Detect which LLMs are active based on provided keys. Build model availability JSON.

Easy 1 hr

03

Prompt Classifier

Classify intent → Research / Coding / Logic / Creative / Planning / Math

Easy 2 hrs

04

Complexity / Difficulty Detector

Easy / Medium / Hard / Agentic — determines if task needs decomposition

Easy 1 hr

05

Router LLM (Core Brain)

Receives prompt + availableModels JSON. Outputs routing plan using ONLY available models.

Medium 3–4 hrs

06

Task Decomposition Engine

Splits complex prompts into subtasks. Assigns best available model per subtask.

Medium 3–4 hrs

07

Token + Cost Estimator

Pre-execution estimate of tokens, $cost, and time. Shown BEFORE user approves.

Medium 2 hrs

08

Execution Plan Preview + User Approval

Show plan (models, subtasks, cost, time). User can approve or modify before execution starts.

Medium 2 hrs

09

Multi-LLM Execution Engine

Sequential/parallel calls to available models only. Aggregates subtask outputs into final result.

Hard 4–5 hrs

10

Live Streaming Output

Stream tokens live per agent. Show progress: which model is running, tokens used so far.

Hard 3–4 hrs

11

Fallback Model System

If a call fails, auto-retry on next available model from the user's active list.

Easy 1 hr

12

Reasoning Graph Visualization

React Flow: animated DAG showing Prompt → Classifier → Model Assignments → Result nodes

Medium 3–4 hrs

13

Analytics + Memory Layer

Supabase: log every execution — models used, tokens, cost, latency, prompt category

Easy 1–2 hrs

14

Confidence Scoring + Benchmark Compare

Post-run quality score per agent. Side-by-side model comparison panel.

Hard 4–5 hrs

👥 Team Task Division

M1

Backend & Orchestration Engineer

Router brain · API security · Execution engine · LLM calls

P1

Project Setup + FastAPI Boilerplate

Repo init, FastAPI/Node, env config, all LLM SDKs installed (OpenAI, Anthropic, Gemini)

BackendSDKs

P2

API Key Vault (Encrypted)

Receive keys from frontend, AES encrypt, store in DB. Decrypt only server-side before LLM calls. NEVER send to browser.

SecurityBackendSupabase

P3

Available Model Registry

On key submission, validate each key with a test call. Build availableModels[] JSON. Expose via /api/models endpoint.

BackendLLM

P4

Router LLM (Core Brain)

System prompt: "You have these models available: {availableModels}. Classify, detect complexity, decide decomposition, assign ONLY available models. Return JSON plan."

LLM PromptCore Logic

P5

Task Decomposition Engine

For Hard/Agentic tasks: LLM generates subtask list → each assigned to best available model → sequential execution

LLMCore Logic

P6

Execution Engine + Fallback

Execute tasks model-by-model. On failure, auto-retry with next available model. Return merged final output.

BackendReliability

P7

REST API Endpoints

/api/keys (POST), /api/models (GET), /api/plan (POST), /api/execute (POST/stream), /api/history (GET)

API

Est. Time~15–17 hrs

Must deliver /api/plan byHour 9

PriorityHIGHEST

M2

Frontend & Visualization Engineer

Dashboard · Reasoning graph · UX flow · Demo polish

P1

Next.js App + Design System

Setup Next.js 14, Tailwind, React Flow, Framer Motion. Define color tokens and component base.

Frontend

P2

API Key Connection Screen

Secure form to input API keys per provider. Shows which models are active/inactive with colored status dots.

UISecurity UX

P3

Prompt Input + Pre-Execution Plan View

User types prompt → system shows: models that will be used, estimated cost/tokens/time, subtasks breakdown. Approve / Modify buttons.

UI

P4

Reasoning Graph Visualization (React Flow)

Animated DAG: Prompt node → Classifier → Subtasks → Model nodes (GPT/Claude/Gemini boxes) → Output node. Nodes light up as execution happens.

React FlowAnimation

P5

Live Execution View + Streaming

Real-time streaming output per agent. Progress bar, token counter, live cost ticker, model status badges.

Streaming UI

P6

Final Result + Analytics Panel

Merged final response. Summary cards: total cost, tokens used, latency, which models ran. Confidence scores per agent.

UI

P7

Demo Mode + Polish

Smooth animations, loading skeletons, empty states, mobile-safe layout. Preloaded demo prompt for judges.

Polish

Est. Time~14–16 hrs

Unblocked for real API atHour 9

PriorityHIGH

M3

Integration, Data & QA Engineer

Token engine · Cost logic · DB · Testing · Pitch deck

P1

Token + Cost Estimation Module

Per-model pricing tables (GPT-4o, Claude Sonnet, Gemini Flash). Given prompt + model → returns estimated tokens + $ cost. Plug into M1's plan generator.

LogicPricing

P2

Supabase Schema + Setup

Tables: api_keys (encrypted), executions (prompt, models_used, tokens, cost, latency, category), users. Row-level security ON.

SupabaseRLS

P3

Analytics Logging (After Each Execution)

After every run, save: prompt category, models used, actual tokens, actual cost, latency. Used for the analytics panel in UI.

DBBackend

P4

Confidence Scoring Module

After each agent responds, send a quick LLM call: "Rate this response quality 0–100 and explain in one line." Attach score to result.

LLMLogic

P5

End-to-End Integration Testing

Test full flow: key input → model detection → plan generation → approval → execution → result. Fix all broken pipes between M1 and M2.

QA

P6

Pitch Deck + Demo Script

5-slide deck: Problem → Solution → Architecture → Demo → Vision. Write judge walkthrough script. Prepare 3 example prompts for live demo.

Presentation

Est. Time~12–14 hrs

Sync with M1 atHour 5, 14, 22

PriorityHIGH

🔗 Dependency & Hand-off Chain

M1: Setup  
0–2hrs

→

M1: API Vault  
\+ Registry  
2–5hrs

→

M1: Router LLM  
\+ Decomposer  
5–9hrs

→

M2 connects  
real API data  
Hour 9

→

M1: Execution  
Engine Live  
9–15hrs

→

M3: Full E2E  
Integration Test  
Hour 20

→

M2: Demo  
Polish  
20–26hrs

→

🏁 Demo  
Ready  
Hour 27

⏱️ 30-Hour Timeline

H 0–2

Phase 1 — Foundation (All Parallel)

M1: Repo + FastAPI + SDK install M2: Next.js + Tailwind + React Flow setup M3: Token/cost tables + Supabase schema

H 2–5

Phase 2 — Security + Core Data

M1: API Key Vault (AES encrypt) + Model Registry M2: Key connection screen + model status UI M3: Cost estimator module + Supabase RLS

H 5–9

Phase 3 — Router Brain + Decomposition

M1: Router LLM prompt + Decomposition Engine + /api/plan M2: Prompt input + Plan preview screen (mocked data) M3: Wire cost estimator into /api/plan response

H 9–14

Phase 4 — Live Integration Sprint

M1: Execution engine + Fallback system + /api/execute M2: Connect real API → Reasoning Graph animates live M3: Analytics logging + Confidence scoring

H 14–20

Phase 5 — Streaming + Full System

M1: Streaming output + Response Aggregator M2: Live streaming UI + Result dashboard + Analytics panel M3: E2E test all flows + fix bugs

H 20–26

Phase 6 — Polish + Demo Prep

M1: Edge cases + stability + hotfix standby M2: Animations, loading states, demo mode, mobile M3: Pitch deck 5 slides + 3 demo prompts scripted

H 26–30

Phase 7 — Buffer + Rehearsal

M1: Hotfix standby M2: Final UI fixes M3: Lead 3× demo dry-runs with full team ALL: Sleep if possible 😅

⚠️ Risks & Mitigations

🔴 High Risk

API Keys Exposed to Browser

Mitigation: NEVER pass keys to frontend. All LLM calls go through your backend. Frontend only sends prompts, never keys. M1 owns this entirely.

🔴 High Risk

Router uses unavailable model

Mitigation: Router LLM system prompt must hard-include availableModels[]. Add a post-plan validator function that rejects any plan containing models NOT in the list.

🔴 High Risk

Backend not ready by Hour 9

Mitigation: M2 builds UI with hardcoded mock JSON from Hour 0. The /api/plan format is agreed upfront so M2 can plug in real data instantly when M1 is ready.

🟡 Medium Risk

Streaming output too complex

Mitigation: Start with non-streaming (full response return). Add streaming only after base flow works. Don't block entire demo on this.

🟡 Medium Risk

Rate limits hit during live demo

Mitigation: Pre-run 5 demo prompts and cache their results. Show cached output as "live" if needed. Have 2 backup API keys ready.

🟢 Low Risk

Confidence scoring looks inaccurate

Mitigation: Frame it as "AI self-assessment" not ground-truth accuracy. Judges will respect the concept even if scores aren't perfect.

🏆

Win Condition

✅ Working BYO-LLM routing ✅ Visual reasoning graph animates ✅ Plan shown BEFORE execution ✅ Only available models are used ✅ Clean secure key flow ✅ Confident demo pitch
