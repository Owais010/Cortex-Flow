'use client';

import { CheckCircle, Circle, Loader, XCircle } from 'lucide-react';
import type { ExecutingMessageData } from '../../lib/types';
import { formatCost, formatTokens } from '../../lib/utils';
import ReasoningGraph from '../ReasoningGraph';

export default function ExecutingMessage({ message }: { message: ExecutingMessageData }) {
  const { plan, completedSubtasks, runningSubtasks, failedSubtasks, liveResults = [] } = message;

  const getIcon = (taskId: number) => {
    if (completedSubtasks.includes(taskId))
      return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
    if (failedSubtasks.includes(taskId))
      return <XCircle size={16} style={{ color: 'var(--error)' }} />;
    if (runningSubtasks.includes(taskId))
      return <Loader size={16} style={{ color: 'var(--accent)', animation: 'spin 1.5s linear infinite' }} />;
    return <Circle size={16} style={{ color: 'var(--text-dim)' }} />;
  };

  const total = plan.subtasks.length;
  const done = completedSubtasks.length + failedSubtasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Running totals from whatever has streamed back so far.
  const liveTokens = liveResults.reduce((sum, r) => sum + (r.tokens ?? 0), 0);
  const liveCost = liveResults.reduce((sum, r) => sum + (r.cost ?? 0), 0);

  return (
    <div className="msg-container">
      <div className="msg-executing">
        <div className="msg-executing-header">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          Executing plan{runningSubtasks.length > 1 ? ` (${runningSubtasks.length} subtasks in parallel)` : ''}...
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            {done}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="exec-progress">
          <div className="exec-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Live reasoning graph */}
        <div style={{ marginTop: 12 }}>
          <ReasoningGraph
            plan={plan}
            live={{
              running: runningSubtasks,
              completed: completedSubtasks,
              failed: failedSubtasks,
              results: liveResults,
            }}
          />
        </div>

        {/* Task checklist */}
        <div className="msg-executing-tasks" style={{ marginTop: 12 }}>
          {plan.subtasks.map(task => {
            const lr = liveResults.find(r => r.id === task.id);
            return (
              <div key={task.id} className={`msg-exec-task${failedSubtasks.includes(task.id) ? ' msg-exec-task-failed' : ''}`}>
                <span className="msg-exec-task-icon">{getIcon(task.id)}</span>
                <span style={{
                  color: runningSubtasks.includes(task.id) ? 'var(--text-primary)' : undefined,
                  textDecoration: failedSubtasks.includes(task.id) ? 'line-through' : undefined,
                  opacity: failedSubtasks.includes(task.id) ? 0.6 : undefined,
                  flex: 1,
                }}>
                  {task.title}
                </span>
                {lr?.status === 'complete' && (lr.tokens !== undefined) && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                    {formatTokens(lr.tokens)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Live totals */}
        {liveResults.length > 0 && (
          <div className="msg-result-analytics" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <span>💰 {formatCost(liveCost)}</span>
            <span>🔤 {formatTokens(liveTokens)} tokens</span>
            <span>✅ {completedSubtasks.length} done</span>
            {failedSubtasks.length > 0 && <span style={{ color: 'var(--error)' }}>✕ {failedSubtasks.length} failed</span>}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .exec-progress {
          height: 3px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 10px;
        }
        .exec-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
          border-radius: 3px;
          transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
    </div>
  );
}
