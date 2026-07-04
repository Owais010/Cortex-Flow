'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Plan, ExecutionResult, Subtask, SubtaskResult } from '../lib/types';
import {
  getModelColor,
  getProviderColor,
  modelToProvider,
  getDifficultyColor,
  getCategoryLabel,
  formatCost,
  formatTokensShort,
  formatLatency,
  truncate,
} from '../lib/utils';

// ============================================
// Layout constants
// ============================================
const COL_W = 240;
const ROW_H = 120;
const NODE_W = 200;

type SubtaskStatus = 'pending' | 'running' | 'complete' | 'failed';

// ============================================
// Custom node data shapes
// ============================================
interface PromptNodeData extends Record<string, unknown> {
  prompt: string;
}
interface RouterNodeData extends Record<string, unknown> {
  category: string;
  difficulty: string;
  needsDecomposition: boolean;
}
interface SubtaskNodeData extends Record<string, unknown> {
  title: string;
  model: string;
  status: SubtaskStatus;
  tokens?: number;
  cost?: number;
  latencyMs?: number;
  usedFallback?: boolean;
}
interface OutputNodeData extends Record<string, unknown> {
  status: SubtaskStatus;
  label: string;
}

// ============================================
// Custom node components
// ============================================
function PromptNode({ data }: NodeProps<Node<PromptNodeData>>) {
  return (
    <div className="rg-node rg-node-prompt">
      <div className="rg-node-label">User Prompt</div>
      <div className="rg-node-prompt-text">{truncate(data.prompt, 90)}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function RouterNode({ data }: NodeProps<Node<RouterNodeData>>) {
  return (
    <div className="rg-node rg-node-router">
      <Handle type="target" position={Position.Left} />
      <div className="rg-node-label">Router Analysis</div>
      <div className="rg-node-badges">
        <span className="rg-badge">{getCategoryLabel(data.category)}</span>
        <span className="rg-badge" style={{ color: getDifficultyColor(data.difficulty), borderColor: getDifficultyColor(data.difficulty) }}>
          {data.difficulty}
        </span>
      </div>
      {data.needsDecomposition && <div className="rg-node-sub">Decomposed</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SubtaskNode({ data }: NodeProps<Node<SubtaskNodeData>>) {
  const color = getModelColor(data.model);
  return (
    <div className={`rg-node rg-node-subtask ${data.status}`} style={{ borderLeftColor: color }}>
      <Handle type="target" position={Position.Left} />
      <div className="rg-node-subtask-head">
        <span className="rg-model-badge" style={{ color, borderColor: color }}>{data.model}</span>
        {data.usedFallback && <span className="rg-fallback" title="Fallback used">⚠</span>}
      </div>
      <div className="rg-node-subtask-title">{data.title}</div>
      {(data.tokens !== undefined || data.cost !== undefined || data.latencyMs !== undefined) && (
        <div className="rg-node-metrics">
          {data.tokens !== undefined && <span>{formatTokensShort(data.tokens)}</span>}
          {data.cost !== undefined && <span>{formatCost(data.cost)}</span>}
          {data.latencyMs !== undefined && <span>{formatLatency(data.latencyMs)}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function OutputNode({ data }: NodeProps<Node<OutputNodeData>>) {
  return (
    <div className={`rg-node rg-node-output ${data.status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="rg-node-label">Final Output</div>
      <div className="rg-node-output-status">{data.label}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  router: RouterNode,
  subtask: SubtaskNode,
  output: OutputNode,
};

// ============================================
// Wave computation (matches backend dependency waves)
// ============================================
function computeWaves(subtasks: Subtask[]): Map<number, number> {
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const waveOf = new Map<number, number>();

  const resolve = (id: number, seen: Set<number>): number => {
    if (waveOf.has(id)) return waveOf.get(id)!;
    const task = byId.get(id);
    const deps = (task?.dependsOn ?? []).filter((d) => byId.has(d) && !seen.has(d));
    if (deps.length === 0) {
      waveOf.set(id, 0);
      return 0;
    }
    const next = new Set(seen).add(id);
    const wave = 1 + Math.max(...deps.map((d) => resolve(d, next)));
    waveOf.set(id, wave);
    return wave;
  };

  subtasks.forEach((s) => resolve(s.id, new Set([s.id])));
  return waveOf;
}

function statusFor(result: SubtaskResult | undefined): SubtaskStatus {
  if (!result) return 'pending';
  if (result.error || !result.output) return 'failed';
  return 'complete';
}

// ============================================
// Graph builder
// ============================================
function buildGraph(plan: Plan, result?: ExecutionResult): { nodes: Node[]; edges: Edge[] } {
  const subtasks = plan.subtasks ?? [];
  const resultById = new Map<number, SubtaskResult>(
    (result?.subtaskResults ?? []).map((r) => [r.id, r]),
  );

  const waveOf = computeWaves(subtasks);
  const maxWave = subtasks.reduce((m, s) => Math.max(m, waveOf.get(s.id) ?? 0), 0);

  // Group subtasks by wave to stack them vertically within a column.
  const byWave = new Map<number, Subtask[]>();
  subtasks.forEach((s) => {
    const w = waveOf.get(s.id) ?? 0;
    if (!byWave.has(w)) byWave.set(w, []);
    byWave.get(w)!.push(s);
  });

  const centerY = (count: number, idx: number) => (idx - (count - 1) / 2) * ROW_H;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Prompt (col 0) and Router (col 1)
  nodes.push({
    id: 'prompt',
    type: 'prompt',
    position: { x: 0, y: -NODE_W / 4 },
    data: { prompt: plan.prompt } as PromptNodeData,
  });
  nodes.push({
    id: 'router',
    type: 'router',
    position: { x: COL_W, y: -NODE_W / 4 },
    data: {
      category: plan.category,
      difficulty: plan.difficulty,
      needsDecomposition: plan.needsDecomposition,
    } as RouterNodeData,
  });
  edges.push(makeEdge('prompt', 'router', 'var(--text-muted)'));

  // Subtask nodes, laid out wave-by-wave
  const outputWave = maxWave + 1;
  subtasks.forEach((s) => {
    const w = waveOf.get(s.id) ?? 0;
    const siblings = byWave.get(w)!;
    const idx = siblings.indexOf(s);
    const res = resultById.get(s.id);
    nodes.push({
      id: `task-${s.id}`,
      type: 'subtask',
      position: { x: (w + 2) * COL_W, y: centerY(siblings.length, idx) },
      data: {
        title: s.title,
        model: res?.model ?? s.assignedModel,
        status: statusFor(res),
        tokens: res?.tokens ?? s.estimatedTokens,
        cost: res?.cost ?? s.estimatedCost,
        latencyMs: res?.latencyMs,
        usedFallback: res?.usedFallback,
      } as SubtaskNodeData,
    });

    const color = getProviderColor(modelToProvider(res?.model ?? s.assignedModel));
    const deps = (s.dependsOn ?? []).filter((d) => subtasks.some((t) => t.id === d));
    if (deps.length === 0) {
      // Wave-0 subtasks connect from the router.
      edges.push(makeEdge('router', `task-${s.id}`, color));
    } else {
      deps.forEach((d) => edges.push(makeEdge(`task-${d}`, `task-${s.id}`, color)));
    }
  });

  // Output node at the far right.
  const outputStatus: SubtaskStatus = result
    ? result.status === 'completed'
      ? 'complete'
      : result.status === 'partial'
        ? 'running'
        : 'failed'
    : 'pending';
  nodes.push({
    id: 'output',
    type: 'output',
    position: { x: (outputWave + 2) * COL_W, y: -NODE_W / 4 },
    data: {
      status: outputStatus,
      label: result ? result.status : 'awaiting execution',
    } as OutputNodeData,
  });

  // Terminal subtasks (nothing depends on them) feed the output node.
  const hasDependents = new Set<number>();
  subtasks.forEach((s) => (s.dependsOn ?? []).forEach((d) => hasDependents.add(d)));
  const terminals = subtasks.filter((s) => !hasDependents.has(s.id));
  const outEdgeSource = terminals.length ? terminals : subtasks;
  outEdgeSource.forEach((s) => {
    const res = resultById.get(s.id);
    const color = getProviderColor(modelToProvider(res?.model ?? s.assignedModel));
    edges.push(makeEdge(`task-${s.id}`, 'output', color));
  });

  return { nodes, edges };
}

function makeEdge(source: string, target: string, color: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    animated: true,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

// ============================================
// Public component
// ============================================
export default function ReasoningGraph({ plan, result }: { plan: Plan; result?: ExecutionResult }) {
  const { nodes, edges } = useMemo(() => buildGraph(plan, result), [plan, result]);

  return (
    <div className="reasoning-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="rgba(255,255,255,0.06)" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
