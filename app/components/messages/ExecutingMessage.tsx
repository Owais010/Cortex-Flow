'use client';

import { CheckCircle, Circle, Loader, XCircle } from 'lucide-react';
import type { ExecutingMessageData } from '../../lib/types';

export default function ExecutingMessage({ message }: { message: ExecutingMessageData }) {
  const { plan, completedSubtasks, runningSubtask, failedSubtasks } = message;

  const getIcon = (taskId: number) => {
    if (completedSubtasks.includes(taskId))
      return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
    if (failedSubtasks.includes(taskId))
      return <XCircle size={16} style={{ color: 'var(--error)' }} />;
    if (runningSubtask === taskId)
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
          Executing plan...
        </div>
        <div className="msg-executing-tasks">
          {plan.subtasks.map(task => (
            <div key={task.id} className="msg-exec-task">
              <span className="msg-exec-task-icon">{getIcon(task.id)}</span>
              <span style={{ color: runningSubtask === task.id ? 'var(--text-primary)' : undefined }}>
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
