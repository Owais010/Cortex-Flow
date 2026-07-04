# Agent Ascend: Multi-Model AI Orchestrator

Agent Ascend is an intelligent, multi-agent LLM orchestration platform that dynamically analyzes user prompts and routes tasks to the most suitable AI models based on task category, reasoning complexity, token requirements, and execution cost. 

By utilizing a Bring-Your-Own-LLM (BYO-LLM) architecture, it intelligently distributes workloads across multiple optimized AI models (OpenAI, Anthropic, Google Gemini) rather than relying on a single generic LLM.

## 🚀 Key Features

### 1. Intelligent Prompt Routing & Categorization
When a user submits a prompt, the system's Router LLM analyzes and classifies it. It automatically routes the task to the most capable LLM for that domain. For instance:
- **Research & Analysis** → Anthropic (Claude Sonnet / Haiku)
- **Coding & Structured Output** → OpenAI (GPT-4o / GPT-4o Mini)
- **Fast Tasks & Summaries** → Google Gemini (Gemini 1.5 Pro / Flash)

### 2. Task Decomposition Engine
Large, complex prompts are expensive and slow when executed in a single inference. Agent Ascend automatically breaks down complex tasks into focused subtasks. Each subtask is assigned to a specialized AI agent, and the orchestrator later aggregates all outputs into one final, high-quality response.

### 3. Secure Key Vault (AES-256 Encryption)
We prioritize security. Your API keys are encrypted with AES-256-GCM before database storage. 
- Keys live in memory for under 50ms during execution calls.
- Keys are never returned in responses or logged anywhere.
- Total control and transparency: Your keys call the providers directly.

### 4. Automatic Fallback & Reliability Engineering
If a preferred model fails, rate-limits, or times out, the system automatically falls back to the next available model. Your tasks always complete seamlessly.

### 5. Cost Estimation & Token Tracking
- **Pre-execution Estimation**: View estimated token usage, execution cost, and response time before running a prompt.
- **Post-execution Analytics**: Track actual costs, token consumption, and model latency across every task.

### 6. Interactive Visual Dashboard
Built to provide complete visibility, the frontend uses an interactive visualization graph to display the prompt flow, task decomposition, model assignment, token estimation, and execution timeline in real-time.

---

## 🏗️ Project Architecture & Structure

The repository is divided into two primary workspaces: the Next.js frontend (`app/`) and the Node.js backend execution engine (`backend/`).

### 🖥️ Frontend (`app/`)
The frontend is a modern web application built with **Next.js**, **React**, and **Tailwind CSS**. It provides the user interface for connecting API keys, submitting prompts, and visualizing the execution flow.
- **`app/page.tsx`**: Landing page showcasing features and provider support.
- **`app/chat/`**: The core chat interface for prompt submission.
- **`app/settings/`**: Secure API key management interface.
- **Interactive Graphs**: Powered by `React Flow` to visualize task decomposition and execution.

### ⚙️ Backend (`backend/`)
The backend is a lightweight, high-performance Node.js server that acts as the orchestration engine. It connects to **Supabase** for database management and analytics.
- **`core/router.js`**: Analyzes prompts and determines optimal LLM routing.
- **`core/executor.js`**: Executes tasks and handles task aggregation.
- **`routes/plan.js`**: Generates execution plans and subtasks from user prompts.
- **`security/vault.js`**: Handles AES-256 encryption and decryption of API keys.

---

## 🔄 How It Works

1. **Connect Your Keys**: Securely add your API keys (OpenAI, Anthropic, Gemini) via the frontend dashboard. The backend encrypts them instantly.
2. **Describe Your Task**: Enter a prompt. The backend router analyzes the complexity and categorizes the intent.
3. **Task Breakdown**: The system decomposes your prompt into logical subtasks and assigns each to the best-suited LLM based on domain strength and token cost.
4. **Review Execution Plan**: The UI presents an execution plan, showing subtasks, assigned models, and cost estimates.
5. **Execute & Aggregate**: Upon approval, the backend executes the subtasks (handling any fallbacks dynamically) and compiles the results into a final response.

---

## 🛠️ Setup Instructions

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create your environment file: `cp env-template.txt .env`
3. Add your Supabase credentials and Encryption Key to `.env`.
4. Install dependencies: `npm install`
5. Start the backend server: `npm start` (Runs on port 8000)

### Frontend Setup
1. Navigate to the root directory (where Next.js configuration resides).
2. Install dependencies: `npm install`
3. Start the Next.js development server: `npm run dev`
4. Access the application at `http://localhost:3000`.

---
*Built for the BYO-LLM Hackathon · 2026*
