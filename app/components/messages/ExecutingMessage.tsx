'use client';

import { CheckCircle, Circle, Loader, XCircle } from 'lucide-react';
import type { ExecutingMessageData } from '../../lib/types';

export default function ExecutingMessage({ message }: { message: ExecutingMessageData }) {
  const { plan, completedSubtasks, runningSubtasks, failedSubtasks } = message;

  const getIcon = (taskId: number) => {
    if (completedSubtasks.includes(taskId))
      return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
    if (failedSubtasks.includes(taskId))
      return <XCircle size={16} style={{ color: 'var(--error)' }} />;
    if (runningSubtasks.includes(taskId))
      return <Loader size={16} style={{ color: 'var(--accent)', animation: 'spin 1.5s linear infinite' }} />;
    return <Circle size={16} style={{ color: 'var(--text-dim)' }} />;
  };

  return (
    <div className="msg-container">
      <div className="msg-executing">
        <div className="msg-executing-header">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          Executing plan{runningSubtasks.length > 1 ? ` (${runningSubtasks.length} subtasks in parallel)` : ''}...
        </div>
        <div className="msg-executing-tasks">
          {plan.subtasks.map(task => (
            <div key={task.id} className={`msg-exec-task${failedSubtasks.includes(task.id) ? ' msg-exec-task-failed' : ''}`}>
              <span className="msg-exec-task-icon">{getIcon(task.id)}</span>
              <span style={{
                color: runningSubtasks.includes(task.id) ? 'var(--text-primary)' : undefined,
                textDecoration: failedSubtasks.includes(task.id) ? 'line-through' : undefined,
                opacity: failedSubtasks.includes(task.id) ? 0.6 : undefined,
              }}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

