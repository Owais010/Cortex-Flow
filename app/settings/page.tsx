'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useChatContext } from '../lib/context';
import { PROVIDERS } from '../lib/types';
import type { ProviderName } from '../lib/types';
import { formatCost } from '../lib/utils';

function ProviderCard({ providerName }: { providerName: ProviderName }) {
  const { connectedProviders, connectProvider, backendOnline } = useChatContext();
  const config = PROVIDERS.find(p => p.name === providerName)!;
  const connected = connectedProviders.find(p => p.provider === providerName && p.status === 'active');

  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await connectProvider(providerName, apiKey.trim());
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provider-card">
      <div className="provider-card-header">
        <span className="provider-card-name">{config.displayName}</span>
        <span className={`status-dot ${connected ? 'connected' : loading ? 'loading' : 'disconnected'}`} />
      </div>
      <div className="provider-card-desc">{config.description}</div>

      {connected ? (
        <>
          <div className="provider-card-connected">
            ✓ Connected
            <span className="provider-card-hint">{connected.hint}</span>
          </div>
        </>
      ) : (
        <>
          <input
            type="password"
            className="provider-card-input"
            placeholder={`Paste your ${config.displayName} API key`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            disabled={loading || !backendOnline}
          />
          <div className="provider-card-actions">
            <button
              className="btn-primary"
              onClick={handleConnect}
              disabled={!apiKey.trim() || loading || !backendOnline}
              style={{ width: '100%' }}
            >
              {loading ? 'Validating...' : 'Connect'}
            </button>
          </div>
          {error && <div className="provider-card-error">{error}</div>}
          {!backendOnline && (
            <div className="provider-card-error">Backend is offline. Start the backend server first.</div>
          )}
        </>
      )}
    </div>
  );
}

function ModelsTable() {
  const { availableModels } = useChatContext();

  if (availableModels.length === 0) {
    return <div className="models-empty">Connect an API key above to see available models.</div>;
  }

  return (
    <div className="models-table-wrap">
      <table className="models-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Provider</th>
            <th>Strengths</th>
            <th>Context</th>
            <th>Cost (in/out per 1k)</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {availableModels.map((model) => (
            <tr key={model.id}>
              <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{model.display_name}</td>
              <td>{model.provider}</td>
              <td>{Array.isArray(model.strengths) ? model.strengths.join(', ') : '—'}</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{(model.context_window / 1000).toFixed(0)}k</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCost(model.cost_per_1k_input)} / {formatCost(model.cost_per_1k_output)}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{model.avg_latency_ms || '—'}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionContextPanel() {
  const { sharedContext, conversationHistory } = useChatContext();
  const hasFacts = sharedContext.facts.length > 0;
  const hasDecisions = sharedContext.decisions.length > 0;
  const hasHistory = conversationHistory.length > 0;
  const hasAny = hasFacts || hasDecisions || hasHistory;

  if (!hasAny) {
    return <div className="models-empty">No session context accumulated yet. Context builds as you use the system.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hasFacts && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Facts ({sharedContext.facts.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sharedContext.facts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </div>
      )}
      {hasDecisions && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Decisions ({sharedContext.decisions.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sharedContext.decisions.map((decision, i) => (
              <li key={i}>{decision}</li>
            ))}
          </ul>
        </div>
      )}
      {hasHistory && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent History ({conversationHistory.length}/5)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conversationHistory.map((entry, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>Turn {i + 1}: {entry.prompt}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.resultSummary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <Link href="/chat" className="settings-back">
          <ArrowLeft size={16} />
          Back to Chat
        </Link>
        <span className="settings-title">Settings</span>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-title">API Keys</div>
          <div className="provider-cards">
            <ProviderCard providerName="openai" />
            <ProviderCard providerName="anthropic" />
            <ProviderCard providerName="google_gemini" />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Available Models</div>
          <ModelsTable />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Session Context</div>
          <SessionContextPanel />
        </div>
      </div>
    </div>
  );
}
