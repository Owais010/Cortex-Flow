# BYO-LLM Orchestrator Backend

Backend server for the BYO-LLM multi-model orchestration platform.

## Setup

1. Copy the environment template:
   ```bash
   cp env-template.txt .env
   ```

2. Edit `.env` with your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   ENCRYPTION_KEY=your-32-char-secret-key
   PORT=8000
   ```

3. Install dependencies (already done):
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server status

### Phase 2: API Key Vault
- `POST /api/keys` - Submit and validate API key
- `GET /api/models?session_id=xxx` - Get available models

### Phase 3: Router LLM Brain
- `POST /api/plan` - Generate execution plan (returns `planId`, subtasks, estimates)

### Phase 4: Execution Engine
- `POST /api/execute` - Execute approved plan (with fallback + analytics summary)

## Endpoint request contracts

### POST `/api/plan`
Body:
```json
{
  "session_id": "uuid",
  "prompt": "Build a market research report",
  "available_models": ["gpt-4o", "claude-sonnet"]
}
```

### POST `/api/execute`
Body (recommended):
```json
{
  "session_id": "uuid",
  "plan_id": "uuid-from-api-plan"
}
```

## Project Structure

```
backend/
├── index.js              # Main entry point
├── package.json          # Dependencies
├── .env                  # Environment variables (create from template)
├── routes/               # API endpoints
│   ├── keys.js          # Key management
│   ├── plan.js          # Plan generation
│   └── execute.js       # Execution engine
├── core/                 # Core logic
│   ├── router.js        # LLM routing
│   ├── executor.js      # Task execution
│   ├── classifier.js    # Prompt classification
│   └── token_counter.js # Token counting
├── security/             # Security modules
│   └── vault.js         # Encryption/decryption
└── db/                   # Database
    ├── supabase.js      # Supabase client
    └── analytics.js     # Analytics tracking
```

## Security Rules

🔴 **API keys NEVER leave the backend**
- Keys encrypted before DB storage
- Keys decrypted only milliseconds before LLM call
- Never return keys in responses
- Never log keys anywhere
