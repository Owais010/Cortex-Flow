'use client';

import { useState } from 'react';
import type { PlanMessageData, Subtask } from '../../lib/types';
import { useChatContext } from '../../lib/context';
import { formatCost, formatTokensShort, getModelColor, getCategoryLabel, getDifficultyColor } from '../../lib/utils';
import { ChevronDown, ChevronRight, Info, GitBranch, Pencil, X, Save } from 'lucide-react';
import * as api from '../../lib/api';

export default function PlanMessage({ message }: { message: PlanMessageData }) {
  const { approvePlan, cancelPlan, updateMessage, activeChatId, isExecuting, availableModels, sessionId } = useChatContext();
  const { plan } = message;
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [showReasoning, setShowReasoning] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedSubtasks, setEditedSubtasks] = useState<Record<number, { model?: string; prompt?: string; title?: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const toggleTask = (id: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = () => {
    if (activeChatId) {
      approvePlan(activeChatId, message.id, plan);
    }
  };

  const handleEnterEdit = () => {
    setEditMode(true);
    setEditError(null);
    // Expand all tasks so user can see what they're editing
    setExpandedTasks(new Set(plan.subtasks.map(t => t.id)));
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedSubtasks({});
    setEditError(null);
  };

  const handleEditField = (taskId: number, field: 'model' | 'prompt' | 'title', value: string) => {
    setEditedSubtasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const handleSaveEdits = async () => {
    const edits: api.PlanEdit[] = [];
    for (const [idStr, changes] of Object.entries(editedSubtasks)) {
      const taskId = Number(idStr);
      const original = plan.subtasks.find(t => t.id === taskId);
      if (!original) continue;

      if (changes.model && changes.model !== original.assignedModel) {
        edits.push({ subtaskId: taskId, field: 'assignedModel', value: changes.model });
      }
      if (changes.prompt !== undefined && changes.prompt !== original.prompt) {
        edits.push({ subtaskId: taskId, field: 'prompt', value: changes.prompt });
      }
      if (changes.title !== undefined && changes.title !== original.title) {
        edits.push({ subtaskId: taskId, field: 'title', value: changes.title });
      }
    }

    if (edits.length === 0) {
      setEditMode(false);
      setEditedSubtasks({});
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const updatedPlan = await api.editPlan(plan.planId, edits, sessionId);
      // Update the message in context with the new plan
      if (activeChatId) {
        updateMessage(activeChatId, message.id, { plan: updatedPlan } as Partial<PlanMessageData>);
      }
      setEditMode(false);
      setEditedSubtasks({});
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save edits');
    } finally {
      setIsSaving(false);
    }
  };

  const getEditedValue = (task: Subtask, field: 'model' | 'prompt' | 'title') => {
    const edits = editedSubtasks[task.id];
    if (!edits) return field === 'model' ? task.assignedModel : field === 'prompt' ? (task.prompt || '') : task.title;
    if (field === 'model') return edits.model ?? task.assignedModel;
    if (field === 'prompt') return edits.prompt ?? (task.prompt || '');
    return edits.title ?? task.title;
  };

  // Get unique model IDs for dropdown
  const modelOptions = availableModels.map(m => m.id);

  const hasEdits = Object.keys(editedSubtasks).length > 0;

  return (
    <div className="msg-container">
      <div className="msg-plan">
        <div className="msg-plan-header">
          <span className="msg-plan-label">
            Execution Plan
            {plan.planVersion && plan.planVersion > 1 && (
              <span className="msg-plan-version">v{plan.planVersion}</span>
            )}
          </span>
          <span
            className="badge"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            {getCategoryLabel(plan.category)}
          </span>
          <span
            className="badge"
            style={{ color: getDifficultyColor(plan.difficulty), borderColor: getDifficultyColor(plan.difficulty) }}
          >
            {plan.difficulty}
          </span>
          {plan.needsDecomposition && (
            <span
              className="badge"
              style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}
            >
              Decomposed
            </span>
          )}
        </div>

        {/* Decomposition Reasoning */}
        {plan.decompositionReasoning && (
          <div className="msg-plan-reasoning-toggle" onClick={() => setShowReasoning(!showReasoning)}>
            <Info size={14} />
            <span>Why this decomposition?</span>
            {showReasoning ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
        {showReasoning && plan.decompositionReasoning && (
          <div className="msg-plan-reasoning-box">
            {plan.decompositionReasoning}
          </div>
        )}

        <ul className="msg-plan-subtasks">
          {plan.subtasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const hasDeps = task.dependsOn && task.dependsOn.length > 0;
            const currentModel = getEditedValue(task, 'model');
            const currentPrompt = getEditedValue(task, 'prompt');
            const currentTitle = getEditedValue(task, 'title');

            return (
              <li key={task.id} className="msg-plan-subtask-wrapper">
                <div
                  className="msg-plan-subtask"
                  onClick={() => toggleTask(task.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="msg-plan-subtask-num">{task.id}</span>
                  {editMode ? (
                    <input
                      className="msg-plan-edit-title"
                      value={currentTitle}
                      onChange={(e) => handleEditField(task.id, 'title', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="msg-plan-subtask-title">{task.title}</span>
                  )}
                  {hasDeps && (
                    <span className="msg-plan-dep-badge" title={`Depends on step ${task.dependsOn!.join(', ')}`}>
                      <GitBranch size={10} />
                      {task.dependsOn!.join(', ')}
                    </span>
                  )}
                  {editMode ? (
                    <select
                      className="msg-plan-edit-model"
                      value={currentModel}
                      onChange={(e) => handleEditField(task.id, 'model', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {modelOptions.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="model-badge"
                      style={{ color: getModelColor(task.assignedModel), borderColor: getModelColor(task.assignedModel) }}
                    >
                      {task.assignedModel}
                    </span>
                  )}
                  {!editMode && task.estimatedCost !== undefined && (
                    <span className="msg-plan-subtask-cost">{formatCost(task.estimatedCost)}</span>
                  )}
                  <span className="msg-plan-expand-icon">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>

                {isExpanded && (
                  <div className="msg-plan-subtask-details">
                    {!editMode && task.modelReasoning && (
                      <div className="msg-plan-detail-row">
                        <span className="msg-plan-detail-label">🧠 Model reasoning</span>
                        <span className="msg-plan-detail-value">{task.modelReasoning}</span>
                      </div>
                    )}
                    <div className="msg-plan-detail-row">
                      <span className="msg-plan-detail-label">📝 Prompt</span>
                      {editMode ? (
                        <textarea
                          className="msg-plan-edit-prompt"
                          value={currentPrompt}
                          onChange={(e) => handleEditField(task.id, 'prompt', e.target.value)}
                          rows={4}
                        />
                      ) : (
                        <span className="msg-plan-detail-value msg-plan-detail-prompt">
                          {task.prompt}
                        </span>
                      )}
                    </div>
                    {hasDeps && (
                      <div className="msg-plan-detail-row">
                        <span className="msg-plan-detail-label">🔗 Depends on</span>
                        <span className="msg-plan-detail-value">
                          Step {task.dependsOn!.join(', Step ')}
                        </span>
                      </div>
                    )}
                    {!editMode && (
                      <div className="msg-plan-detail-row">
                        <span className="msg-plan-detail-label">📊 Estimates</span>
                        <span className="msg-plan-detail-value">
                          ~{formatTokensShort(task.estimatedTokens || 0)} tokens · {formatCost(task.estimatedCost || 0)} · ~{task.estimatedTime || 0}s
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {editError && (
          <div className="msg-plan-edit-error">
            ⚠ {editError}
          </div>
        )}

        <div className="msg-plan-totals">
          <span>💰 {formatCost(plan.totalEstimate.cost)}</span>
          <span>🔤 ~{formatTokensShort(plan.totalEstimate.tokens)} tokens</span>
          <span>⏱ ~{plan.totalEstimate.timeSeconds}s</span>
        </div>

        <div className="msg-plan-actions">
          {editMode ? (
            <>
              <button className="btn-ghost" onClick={handleCancelEdit} disabled={isSaving}>
                <X size={14} /> Cancel Edit
              </button>
              <button className="btn-primary" onClick={handleSaveEdits} disabled={isSaving}>
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save & Recalculate'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" disabled={isExecuting} onClick={() => {
                if (activeChatId) cancelPlan(activeChatId, message.id);
              }}>
                Cancel
              </button>
              <button className="btn-ghost btn-edit" onClick={handleEnterEdit} disabled={isExecuting}>
                <Pencil size={14} /> Edit Plan
              </button>
              <button className="btn-primary" onClick={handleApprove} disabled={isExecuting}>
                ✓ Approve & Execute
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
