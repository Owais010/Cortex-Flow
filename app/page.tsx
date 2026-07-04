import Link from 'next/link';
import { ArrowRight, Shield, Zap, Brain, GitBranch, BarChart3, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="landing-nav">
        <span className="landing-nav-logo">AGENT ASCEND</span>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          <a href="#providers" className="landing-nav-link">Providers</a>
          <Link href="/login" className="landing-nav-cta">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-badge">Multi-Model AI Orchestration</div>
        <h1 className="landing-hero-title">
          Route your prompts to the
          <br />
          <span className="landing-hero-accent">right AI model</span>
        </h1>
        <p className="landing-hero-desc">
          Agent Ascend intelligently analyzes your tasks and distributes them across
          multiple AI models — GPT-4o, Claude Sonnet, Gemini — for faster, cheaper,
          and better results. Bring your own API keys. We never store them in plain text.
        </p>
        <div className="landing-hero-actions">
          <Link href="/login" className="landing-btn-primary">
            Start Building <ArrowRight size={16} />
          </Link>
          <a href="#how-it-works" className="landing-btn-ghost">
            See How It Works
          </a>
        </div>

        {/* Stats */}
        <div className="landing-hero-stats">
          <div className="landing-stat">
            <span className="landing-stat-value">3</span>
            <span className="landing-stat-label">AI Providers</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">AES-256</span>
            <span className="landing-stat-label">Key Encryption</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">&lt;50ms</span>
            <span className="landing-stat-label">Key In Memory</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features" id="features">
        <h2 className="landing-section-title">Why Agent Ascend?</h2>
        <p className="landing-section-desc">
          Stop sending every prompt to one model. Different tasks need different AI strengths.
        </p>

        <div className="landing-features-grid">
          <div className="landing-feature">
            <div className="landing-feature-icon"><Brain size={22} /></div>
            <h3>Intelligent Routing</h3>
            <p>Our router LLM analyzes your prompt and assigns subtasks to the model best suited for each — research to Claude, coding to GPT, fast tasks to Gemini.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon"><GitBranch size={22} /></div>
            <h3>Task Decomposition</h3>
            <p>Complex prompts are automatically split into focused subtasks, each handled by a specialist model for higher quality output.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon"><Shield size={22} /></div>
            <h3>Secure Key Vault</h3>
            <p>Your API keys are encrypted with AES-256-GCM before storage. They live in memory for under 50ms during calls and are never returned in responses.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon"><Zap size={22} /></div>
            <h3>Automatic Fallback</h3>
            <p>If a model fails or rate-limits, the system automatically retries with the next available model. Your task always completes.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon"><BarChart3 size={22} /></div>
            <h3>Cost & Token Tracking</h3>
            <p>See estimated costs before execution and actual costs after. Track tokens, latency, and model usage across every task.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon"><Lock size={22} /></div>
            <h3>Your Keys, Your Data</h3>
            <p>We never proxy through our own accounts. Your API keys call the providers directly. Full control, full transparency.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how" id="how-it-works">
        <h2 className="landing-section-title">How It Works</h2>
        <p className="landing-section-desc">Three steps from prompt to production-quality output.</p>

        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-num">01</div>
            <h3>Connect Your Keys</h3>
            <p>Paste your OpenAI, Anthropic, or Google Gemini API keys. They&apos;re encrypted instantly and never leave the server.</p>
          </div>
          <div className="landing-step-arrow">→</div>
          <div className="landing-step">
            <div className="landing-step-num">02</div>
            <h3>Describe Your Task</h3>
            <p>Type any prompt — from research reports to code reviews. The router analyzes complexity, category, and optimal model assignments.</p>
          </div>
          <div className="landing-step-arrow">→</div>
          <div className="landing-step">
            <div className="landing-step-num">03</div>
            <h3>Review & Execute</h3>
            <p>Preview the execution plan with cost estimates. Approve it, and watch each subtask complete with real-time progress tracking.</p>
          </div>
        </div>
      </section>

      {/* Providers */}
      <section className="landing-providers" id="providers">
        <h2 className="landing-section-title">Supported Providers</h2>
        <p className="landing-section-desc">Bring one key or all three. The router adapts to what you have.</p>

        <div className="landing-provider-cards">
          <div className="landing-provider-card">
            <div className="landing-provider-name" style={{ color: 'var(--openai)' }}>OpenAI</div>
            <div className="landing-provider-models">GPT-4o · GPT-4o Mini</div>
            <div className="landing-provider-strength">Best for coding, structured output, technical tasks</div>
          </div>
          <div className="landing-provider-card">
            <div className="landing-provider-name" style={{ color: 'var(--anthropic)' }}>Anthropic</div>
            <div className="landing-provider-models">Claude Sonnet · Claude Haiku</div>
            <div className="landing-provider-strength">Best for research, analysis, long-form reasoning</div>
          </div>
          <div className="landing-provider-card">
            <div className="landing-provider-name" style={{ color: 'var(--gemini)' }}>Google Gemini</div>
            <div className="landing-provider-models">Gemini 1.5 Pro · Gemini Flash</div>
            <div className="landing-provider-strength">Best for fast tasks, summaries, multimodal input</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>Ready to orchestrate?</h2>
        <p>Connect your first API key and send your first multi-model prompt in under 2 minutes.</p>
        <Link href="/login" className="landing-btn-primary">
          Get Started Free <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span className="landing-footer-logo">AGENT ASCEND</span>
        <span className="landing-footer-text">Built for the BYO-LLM Hackathon · 2026</span>
      </footer>
    </div>
  );
}
