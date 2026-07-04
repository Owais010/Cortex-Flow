'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ResultMessageData, SubtaskResult } from '../../lib/types';
import { formatCost, formatTokens, formatLatency, getModelColor } from '../../lib/utils';

function SubtaskDetail({ result }: { result: SubtaskResult }) {
  const [open, setOpen] = useState(false);

  const confidenceColor = (result.confidenceScore ?? 0) >= 80
    ? 'var(--success)'
    : (result.confidenceScore ?? 0) >= 50
      ? 'var(--warning)'
      : 'var(--error)';

  return (
    <div className="subtask-detail">
      <button className="subtask-detail-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span
          className="model-badge"
          style={{ color: getModelColor(result.model), borderColor: getModelColor(result.model) }}
        >
          {result.model}
        </span>
        <span style={{ flex: 1 }}>{result.title}</span>
        {result.usedFallback && (
          <span title="Fallback used"><AlertTriangle size={12} style={{ color: 'var(--warning)' }} /></span>
        )}
        {result.confidenceScore !== undefined && (
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: confidenceColor }}>
            {result.confidenceScore}%
          </span>
        )}
      </button>
      {open && (
        <div className="subtask-detail-body">
          {result.confidenceScore !== undefined && (
            <>
              <div className="subtask-detail-row">
                <span className="subtask-detail-label">Confidence</span>
                <span className="subtask-detail-value" style={{ color: confidenceColor }}>
                  {result.confidenceScore}/100
                </span>
              </div>
              <div className="confidence-bar">
                <div
                  className="confidence-bar-fill"
                  style={{ width: `${result.confidenceScore}%`, background: confidenceColor }}
                />
              </div>
            </>
          )}
          {result.confidenceNote && (
            <div className="subtask-detail-row">
              <span className="subtask-detail-label">Note</span>
              <span className="subtask-detail-value">{result.confidenceNote}</span>
            </div>
          )}
          {result.tokens !== undefined && (
            <div className="subtask-detail-row">
              <span className="subtask-detail-label">Tokens</span>
              <span className="subtask-detail-value">{formatTokens(result.tokens)}</span>
            </div>
          )}
          {result.cost !== undefined && (
            <div className="subtask-detail-row">
              <span className="subtask-detail-label">Cost</span>
              <span className="subtask-detail-value">{formatCost(result.cost)}</span>
            </div>
          )}
          {result.latencyMs !== undefined && (
            <div className="subtask-detail-row">
              <span className="subtask-detail-label">Latency</span>
              <span className="subtask-detail-value">{formatLatency(result.latencyMs)}</span>
            </div>
          )}
          {result.usedFallback && (
            <div className="subtask-detail-row">
              <span className="subtask-detail-label" style={{ color: 'var(--warning)' }}>⚠ Fallback was used</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultMessage({ message }: { message: ResultMessageData }) {
  const [tab, setTab] = useState<'response' | 'details'>('response');
  const { result } = message;

  return (
    <div className="msg-container">
      <div className="msg-result">
        <div className="msg-result-tabs">
          <button
            className={`msg-result-tab ${tab === 'response' ? 'active' : ''}`}
            onClick={() => setTab('response')}
          >
            Response
          </button>
          <button
            className={`msg-result-tab ${tab === 'details' ? 'active' : ''}`}
            onClick={() => setTab('details')}
          >
            Details ({result.subtaskResults.length})
          </button>
        </div>

        <div className="msg-result-content">
          {tab === 'response' && (
            <div className="msg-result-output">
              {result.finalOutput ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.finalOutput}
                </ReactMarkdown>
              ) : (
                <div style={{ color: 'var(--error)', padding: '10px 0' }}>
                  Execution failed. Please check the Details tab for more information.
                  {result.subtaskResults.some(r => r.confidenceNote?.includes('Execution failed')) && (
                    <div style={{ marginTop: '10px', fontSize: '0.9em', opacity: 0.8 }}>
                      Error: {result.subtaskResults.find(r => r.confidenceNote?.includes('Execution failed'))?.confidenceNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'details' && (
            <div>
              {result.subtaskResults.map((sr) => (
                <SubtaskDetail key={sr.id} result={sr} />
              ))}
            </div>
          )}
        </div>

        <div className="msg-result-analytics">
          <span>💰 {formatCost(result.analytics.totalCost)}</span>
          <span>🔤 {formatTokens(result.analytics.totalTokens)} tokens</span>
          <span>⏱ {formatLatency(result.analytics.totalTimeMs)}</span>
          <span>🤖 {result.analytics.modelsUsed.join(', ')}</span>
          <span style={{ color: result.status === 'completed' ? 'var(--success)' : 'var(--error)' }}>
            {result.status}
          </span>
        </div>
      </div>
    </div>
  );
}
