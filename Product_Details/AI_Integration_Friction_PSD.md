## 1. The Problem Being Solved

Engineering teams in 2026 run their work across a fractured landscape of AI tools. A single team might use GitHub Copilot for inline code suggestions, Claude for architecture decisions, ChatGPT for debugging, and Gemini for documentation. Each tool is paid for separately. Each tool has no knowledge of what the others said. Each requires re-explaining context from scratch with every new session.

### The core friction points

Context is non-transferable. Switching between Cursor, Claude Code, and ChatGPT means rewriting the entire codebase context every time — costing 10–20 minutes per switch.

Cost is invisible. Teams have no unified view of what they’re spending across providers. OpenAI + Anthropic + Google bills arrive separately with no breakdown by team, task, or model.

Model selection is guesswork. Developers default to one model for everything, missing significant latency and cost savings from routing different tasks to the right model.

No shared memory. Every AI conversation starts cold. Yesterday’s architectural decision, last week’s bug context — gone. Teams re-explain the same things repeatedly across sessions and teammates.

Governance is an afterthought. As AI usage grows, there is no audit trail, no per-user usage policy, and no way to enforce which models are approved for sensitive code.

## 2. Who Experiences This Problem

This is not a niche developer pain point. It is felt across every technical team that has adopted more than one AI tool — which, as of 2026, is the majority.

### Primary persona — The AI-first engineering team

### Secondary personas

## 3. Why Current Solutions Fail

Three categories of tools exist today — and all three miss the mark for the team-level, indie-accessible use case.

## 4. Why This Matters Now

The timing for this product is not arbitrary. Three structural shifts in early 2026 have created an acute, urgent version of a chronic pain.

### Trigger 1 — Multi-agent tools shipped simultaneously

Cursor 3.0 (March 2026) launched a multi-agent window. Claude Code shipped named sub-agents and MCP protocol (April 2026). OpenAI Codex introduced an exec-server for remote agent orchestration. All in the same quarter. The fragmentation is no longer theoretical — it is now structurally baked into the tooling landscape.

### Trigger 2 — Vercel AI SDK 5 made unified provider abstraction trivial

The AI SDK 5 release (July 2025) introduced a global provider system, SSE-based streaming, and dynamic tooling across all major LLM providers. What would have taken 2 weeks of integration work now takes 2 hours. The infrastructure is finally ready to build on.

### Trigger 3 — AI spend is now a real budget line

In 2024, AI tools were experiments. In 2026, they are operating expenses. Engineering teams are now being asked to justify AI spend — and no tool gives them the data to do it. The CFO problem has arrived and there is no solution in the market.

## 5. Real-World Impact

### Quantified time loss

A team of 5 engineers, each switching AI tools 4 times a day and spending 12 minutes re-explaining context per switch: that is 4 hours of lost engineering time per day, per team. At a blended rate of ₹2,500/hour, that is ₹10,000/day or ₹22 lakh per year — from context switching alone.

### Cost leakage (estimated)

### Community evidence — direct user complaints

## 6. Hackathon Theme Alignment

This problem aligns with the hackathon’s SaaS domain (Problem #46) and scores strongly across the standard judging rubrics.

## 7. What We Are Building

A unified AI routing dashboard that gives engineering teams one place to run prompts across any LLM, compare responses and cost side-by-side, and share memory across sessions and teammates.

### Core features (in delivery priority)

Multi-provider router — Paste API keys for Anthropic, OpenAI, and Gemini. Every prompt is routed based on task type, cost, or manual selection.

Side-by-side streaming comparison — One prompt, three models streaming simultaneously. Latency and cost-per-call shown as each stream completes.

Cost analytics dashboard — Total spend per provider, average latency, cheapest model per task category. Recharts bar chart updated live.

Shared cross-session memory — Previous calls stored in Supabase. Before each new call, the last 5 relevant exchanges are injected as context automatically.

### The demo in 90 seconds

Step 1: Paste 3 API keys (10 seconds)

Step 2: Type one prompt. Watch Claude, GPT-4o, and Gemini stream simultaneously (30 seconds)

Step 3: Show the cost breakdown — same output, three different prices (10 seconds)

Step 4: Type a follow-up. AI already knows the context from the last session (20 seconds)

Step 5: Show the analytics dashboard — total spend, latency chart, cheapest model recommendation (20 seconds)

## 8. Team Roles & Stack Ownership

Each role maps directly to a layer of the tech stack. No overlap, no gaps.

## 9. Build Timeline (48-Hour Sprint)

## 10. Definition of Done — Minimum Demo Bar

### Non-negotiable for demo day

Multi-provider streaming working live on stage (no pre-recorded video)

Cost per call displayed correctly for at least 2 providers

Shared memory working — a follow-up prompt in a new session shows retained context

Auth working — judges can log in with Google and see a personalised dashboard

Analytics table or chart visible with seeded data

### Nice-to-have (if time allows)

Smart routing — AI automatically selects the cheapest model for simple tasks

Export cost report as CSV

Team invite flow — multiple users sharing the same memory pool


|

| PROBLEM STATEMENT DOCUMENT
AI Integration Friction
Problem #46  •  SaaS Domain  •  AI Hackathon 2026
Version 1.0    |    May 2026    |    Internal Team Use Only |





|

| MISSION STATEMENT
Give every developer team a single intelligent hub that routes prompts to the right AI model, tracks real cost across providers, and shares memory across sessions — so they stop paying for three tools that don’t talk to each other. |





|

| Document Owner | Team Lead / Product |

| Status | Final — Ready for Build |

| Hackathon Theme | AI Integration & Developer Productivity |

| Build Window | 24–48 hours |

| Problem ID | #46 — SaaS Domain |

| Last Updated | May 2026 |





|

|  | THE CORE INSIGHT
The problem is not that AI tools are bad. It is that they were built to be used in isolation — but teams use them together. The gap between how these tools were designed and how they are actually used is where the friction lives. |





|

| Team size | 5–50 engineers at a SaaS company or AI-native startup |

| AI tools in use | GitHub Copilot + Claude Code + ChatGPT + one internal LLM |

| Monthly AI spend | ₹40,000–₹2,00,000 across providers, tracked by no one |

| Daily frustration | Re-explaining context, duplicate costs, no model comparison |

| Decision maker | Engineering lead or CTO who sees the tool sprawl but has no fix |





|

| Persona | Their pain | What they need |

| Solo founder / indie hacker | Paying for 3 AI subscriptions, using 30% of each | One unified interface + cost visibility |

| Platform / DevOps engineer | No audit trail for AI calls, no governance | Per-user usage logs, model access control |

| Junior developer | Doesn’t know which model to use for which task | Smart routing that picks the right model automatically |

| Tech lead | Team members using different models with no consistency | Shared memory + standardised prompting across the team |





|

| Tool | What it does | Why it fails |

| LiteLLM | Unified LLM proxy / API layer | CLI-only, no dashboard, no team memory, requires DevOps setup |

| Portkey.ai | AI gateway with routing + analytics | Enterprise pricing ($500+/mo), complex config, no India-tier plan |

| OpenRouter | Model routing and switching | No cost analytics, no shared memory, no team features |

| Continue.dev | IDE plugin for AI coding | IDE-specific, no cross-tool portability, no cost visibility |

| Each provider’s own console | Provider-specific usage dashboard | Siloed — you need 3 browser tabs to understand total spend |





|

|  | THE WEDGE
LiteLLM exists but has no UI. Portkey is enterprise-priced. OpenRouter does routing but not memory. No product today gives an indie team or small SaaS company a single dashboard that combines routing + cost analytics + shared memory in under 5 minutes of setup. |





|

|  | WHY NOT 6 MONTHS AGO
Six months ago, Vercel AI SDK 4 made multi-provider calls awkward. Claude Code sub-agents didn’t exist. AI spend was still under the radar. All three changed in the first half of 2026 — which is exactly what makes this the right moment to build. |





|

| Typical team AI spend (5 engineers) | ₹75,000–₹1,50,000 / month |

| Estimated over-spend from wrong model routing | 25–40% (using GPT-4o for tasks Haiku could handle) |

| Duplicate tool subscriptions | ₹20,000–₹50,000 / month on overlapping capabilities |

| Recoverable with smart routing | ₹30,000–₹80,000 / month per team |





|

| “We’re paying for Copilot, Claude, and ChatGPT and none of them know what the others said.”
Hacker News thread on AI tool sprawl — 600+ points, Jan 2026 |

| “I spent 3 days setting up evals before writing a single line of product code.”
r/SaaS — 780 upvotes, Feb 2026 |

| “You spend more time explaining context to Claude than actually coding.”
r/ClaudeAI — 847 upvotes, March 2026 |

| “Our AI bill is ₹1.2L this month and I have no idea what it was spent on.”
Indian founders Slack group, April 2026 |





|

| Judging Criterion | How our build addresses it | Score |

| Problem Severity | Daily pain for any team using 2+ AI tools. Community complaints with 600–850 upvotes. | ★★★★★ |

| Market Size | 4M+ developers using AI IDEs as of 2026. Every SaaS company is affected. | ★★★★★ |

| Technical Depth | Multi-provider streaming, tool routing, shared vector memory, real-time analytics. | ★★★★☆ |

| Demo-ability | Side-by-side model comparison streams live on stage. Judges see cost change in real time. | ★★★★★ |

| Innovation | Shared cross-session memory layer is genuinely novel. No current tool offers this. | ★★★★☆ |

| Build feasibility | Vercel AI SDK 5 + Supabase + shadcn — all primitives exist. Team can ship in 24 hrs. | ★★★★★ |





|

| Role | Owner | Primary Deliverable | Stack Owned |

| Frontend Lead | TBD | Side-by-side comparison UI + analytics dashboard | Next.js, shadcn/ui, Recharts, v0.dev |

| Backend / AI Lead | TBD | Multi-provider router + streaming endpoint | Vercel AI SDK 5, Next.js API routes, Anthropic/OpenAI/Gemini SDKs |

| DB / Memory Lead | TBD | Schema, call logging, shared memory injection | Supabase, Drizzle ORM, pgvector |

| Auth / DevOps | TBD | Clerk setup, Vercel deploy, env management | Clerk, Vercel, GitHub Actions |

| Demo / Product | TBD | Seed data, demo script, pitch deck | All of the above — integration tester |





|

| Hour range | Phase | Deliverable |

| 0–1 hr | Scaffold + Deploy | Next.js project, Vercel connected, live URL, Clerk auth working with Google SSO |

| 1–2 hr | DB + Schema | Supabase project, api_keys and calls tables, Drizzle schema pushed |

| 2–5 hr | AI Router | Route handler streaming to all 3 providers, cost calculated per call, logged to Supabase |

| 5–10 hr | Comparison UI | Side-by-side 3-column grid, streaming tokens, latency + cost badges (v0.dev generated) |

| 10–18 hr | Memory + Dashboard | Shared context injection, Recharts analytics, cost-per-provider breakdown |

| 18–24 hr | Polish + Demo | Seed realistic data, rehearse 90-second demo, edge case fixes |

| 24–48 hr | Buffer + Pitch | Reserve for judges’ Q&A prep, unexpected bugs, deck finalisation |





|

|  | THE BAR
If a judge can watch prompts stream to 3 models simultaneously, see the cost difference in real time, and then see a follow-up prompt that already knows the previous context — you have won the demo. Everything else is polish. |





|

| AI Integration Friction — Hackathon 2026
Build fast. Demo clean. Ship something the judges wish existed yesterday. |


