'use client';

import Link from 'next/link';
import { ArrowRight, Shield, Zap, Brain, GitBranch, BarChart3, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import ParticleGrid from './components/ParticleGrid';
import Typewriter from './components/Typewriter';
import ScrollReveal from './components/ScrollReveal';
import GlowCard from './components/GlowCard';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

export default function HomePage() {
  return (
    <div className="landing">
      {/* Interactive particle background */}
      <ParticleGrid />

      {/* Gradient orbs */}
      <div className="landing-orb landing-orb-1" aria-hidden="true" />
      <div className="landing-orb landing-orb-2" aria-hidden="true" />
      <div className="landing-orb landing-orb-3" aria-hidden="true" />

      {/* Navigation */}
      <motion.nav
        className="landing-nav"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <span className="landing-nav-logo">CORTEX FLOW</span>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          <a href="#providers" className="landing-nav-link">Providers</a>
          <Link href="/login" className="landing-nav-cta">Get Started</Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="landing-hero">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="landing-hero-badge">
            <span className="landing-badge-pulse" />
            Multi-Model AI Orchestration
          </motion.div>

          <motion.h1 variants={itemVariants} className="landing-hero-title">
            Route your prompts to the
            <br />
            <span className="landing-hero-accent">
              <Typewriter text="right AI model" speed={80} />
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="landing-hero-desc">
            Cortex Flow intelligently analyzes your tasks and distributes them across
            multiple AI models — GPT-4o, Claude Sonnet, Gemini — for faster, cheaper,
            and better results. Bring your own API keys. We never store them in plain text.
          </motion.p>

          <motion.div variants={itemVariants} className="landing-hero-actions">
            <Link href="/login" className="landing-btn-primary">
              Start Building <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="landing-btn-ghost">
              See How It Works
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="landing-hero-stats">
            {[
              { value: '3', label: 'AI Providers' },
              { value: 'AES-256', label: 'Key Encryption' },
              { value: '<50ms', label: 'Key In Memory' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="landing-stat"
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <span className="landing-stat-value">{stat.value}</span>
                <span className="landing-stat-label">{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="landing-features" id="features">
        <ScrollReveal>
          <h2 className="landing-section-title">Why Cortex Flow?</h2>
          <p className="landing-section-desc">
            Stop sending every prompt to one model. Different tasks need different AI strengths.
          </p>
        </ScrollReveal>

        <div className="landing-features-grid">
          {[
            { icon: Brain, title: 'Intelligent Routing', desc: 'Our router LLM analyzes your prompt and assigns subtasks to the model best suited for each — research to Claude, coding to GPT, fast tasks to Gemini.', color: 'rgba(255, 255, 255, 0.03)' },
            { icon: GitBranch, title: 'Task Decomposition', desc: 'Complex prompts are automatically split into focused subtasks, each handled by a specialist model for higher quality output.', color: 'rgba(255, 255, 255, 0.03)' },
            { icon: Shield, title: 'Secure Key Vault', desc: 'Your API keys are encrypted with AES-256-GCM before storage. They live in memory for under 50ms during calls and are never returned in responses.', color: 'rgba(16, 185, 129, 0.03)' },
            { icon: Zap, title: 'Automatic Fallback', desc: 'If a model fails or rate-limits, the system automatically retries with the next available model. Your task always completes.', color: 'rgba(255, 171, 64, 0.03)' },
            { icon: BarChart3, title: 'Cost & Token Tracking', desc: 'See estimated costs before execution and actual costs after. Track tokens, latency, and model usage across every task.', color: 'rgba(249, 112, 102, 0.03)' },
            { icon: Lock, title: 'Your Keys, Your Data', desc: 'We never proxy through our own accounts. Your API keys call the providers directly. Full control, full transparency.', color: 'rgba(96, 165, 250, 0.03)' },
          ].map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 0.1}>
              <GlowCard className="landing-feature" glowColor={feature.color}>
                <div className="landing-feature-icon"><feature.icon size={22} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how" id="how-it-works">
        <ScrollReveal>
          <h2 className="landing-section-title">How It Works</h2>
          <p className="landing-section-desc">Three steps from prompt to production-quality output.</p>
        </ScrollReveal>

        <div className="landing-steps">
          {[
            { num: '01', title: 'Connect Your Keys', desc: "Paste your OpenAI, Anthropic, or Google Gemini API keys. They're encrypted instantly and never leave the server." },
            { num: '02', title: 'Describe Your Task', desc: 'Type any prompt — from research reports to code reviews. The router analyzes complexity, category, and optimal model assignments.' },
            { num: '03', title: 'Review & Execute', desc: 'Preview the execution plan with cost estimates. Approve it, and watch each subtask complete with real-time progress tracking.' },
          ].map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 0.15} direction={i === 0 ? 'left' : i === 2 ? 'right' : 'up'}>
              {i > 0 && <div className="landing-step-arrow">→</div>}
              <GlowCard className="landing-step" glowColor="rgba(255, 255, 255, 0.025)">
                <div className="landing-step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Providers */}
      <section className="landing-providers" id="providers">
        <ScrollReveal>
          <h2 className="landing-section-title">Supported Providers</h2>
          <p className="landing-section-desc">Bring one key or all three. The router adapts to what you have.</p>
        </ScrollReveal>

        <div className="landing-provider-cards">
          {[
            { name: 'OpenAI', models: 'GPT-4o · GPT-4o Mini', strength: 'Best for coding, structured output, technical tasks', color: 'var(--openai)', glow: 'rgba(16, 185, 129, 0.03)' },
            { name: 'Anthropic', models: 'Claude Sonnet · Claude Haiku', strength: 'Best for research, analysis, long-form reasoning', color: 'var(--anthropic)', glow: 'rgba(249, 112, 102, 0.03)' },
            { name: 'Google Gemini', models: 'Gemini 1.5 Pro · Gemini Flash', strength: 'Best for fast tasks, summaries, multimodal input', color: 'var(--gemini)', glow: 'rgba(96, 165, 250, 0.03)' },
          ].map((provider, i) => (
            <ScrollReveal key={provider.name} delay={i * 0.12}>
              <GlowCard className="landing-provider-card" glowColor={provider.glow}>
                <div className="landing-provider-name" style={{ color: provider.color }}>{provider.name}</div>
                <div className="landing-provider-models">{provider.models}</div>
                <div className="landing-provider-strength">{provider.strength}</div>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <ScrollReveal>
          <h2>Ready to orchestrate?</h2>
          <p>Connect your first API key and send your first multi-model prompt in under 2 minutes.</p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link href="/login" className="landing-btn-primary">
              Get Started Free <ArrowRight size={16} />
            </Link>
          </motion.div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span className="landing-footer-logo">CORTEX FLOW</span>
        <span className="landing-footer-text">Built for the BYO-LLM Hackathon · 2026</span>
      </footer>
    </div>
  );
}
