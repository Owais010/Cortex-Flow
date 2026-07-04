// ============================================
// Provider & Model Types
// ============================================

export type ProviderName = 'openai' | 'anthropic' | 'google_gemini';

export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  description: string;
  keyPrefix: string;
  color: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini',
    keyPrefix: 'sk-',
    color: 'var(--openai)',
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude Sonnet, Claude Haiku',
    keyPrefix: 'sk-ant-',
    color: 'var(--anthropic)',
  },
  {
    name: 'google_gemini',
    displayName: 'Google Gemini',
    description: 'Gemini 1.5 Pro, Gemini Flash',
    keyPrefix: 'AI',
    color: 'var(--gemini)',
  },
];

export interface ConnectedProvider {
  provider: ProviderName;
  status: 'active' | 'invalid';
  hint: string;
  validated_at: string;
  error?: string | null;
}

export interface AvailableModel {
  id: string;
  provider: ProviderName;
  display_name: string;
  strengths: string[];
  context_window: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  avg_latency_ms: number;
  supports_streaming: boolean;
  supports_json_mode: boolean;
}

// ============================================
// Plan Types
// ============================================

export interface Subtask {
  id: number;
  title: string;
  assignedModel: string;
  modelReasoning?: string | null;
  prompt?: string;
  dependsOn?: number[];
  estimatedTokens?: number;
  estimatedCost?: number;
  estimatedTime?: number;
}

export interface PlanEstimate {
  tokens: number;
  cost: number;
  timeSeconds: number;
}

export interface Plan {
  planId: string;
  prompt: string;
  category: string;
  difficulty: string;
  needsDecomposition: boolean;
  decompositionReasoning?: string | null;
  availableModels: string[];
  subtasks: Subtask[];
  totalEstimate: PlanEstimate;
  planVersion?: number;
}

// ============================================
// Execution Result Types
// ============================================

export interface SubtaskResult {
  id: number;
  title: string;
  model: string;
  output: string;
  tokens?: number;
  cost?: number;
  latencyMs?: number;
  usedFallback?: boolean;
  confidenceScore?: number;
  confidenceNote?: string;
}

export interface ExecutionAnalytics {
  totalTokens: number;
  totalCost: number;
  totalTimeMs: number;
  modelsUsed: string[];
}

export interface ExecutionResult {
  planId: string;
  status: 'completed' | 'partial' | 'failed';
  subtaskResults: SubtaskResult[];
  finalOutput: string;
  analytics: ExecutionAnalytics;
}

// ============================================
// Message Types
// ============================================

export type MessageType = 'user' | 'plan' | 'executing' | 'result' | 'error' | 'system';

export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: string;
}

export interface UserMessageData extends BaseMessage {
  type: 'user';
  content: string;
}

export interface SystemMessageData extends BaseMessage {
  type: 'system';
  content: string;
}

export interface PlanMessageData extends BaseMessage {
  type: 'plan';
  plan: Plan;
}

export interface ExecutingMessageData extends BaseMessage {
  type: 'executing';
  plan: Plan;
  completedSubtasks: number[];
  runningSubtask: number | null;
  failedSubtasks: number[];
}

export interface ResultMessageData extends BaseMessage {
  type: 'result';
  result: ExecutionResult;
  plan: Plan;
}

export interface ErrorMessageData extends BaseMessage {
  type: 'error';
  content: string;
}

export type Message =
  | UserMessageData
  | SystemMessageData
  | PlanMessageData
  | ExecutingMessageData
  | ResultMessageData
  | ErrorMessageData;

// ============================================
// Chat Types
// ============================================

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// ============================================
// App State
// ============================================

export interface AppState {
  sessionId: string;
  connectedProviders: ConnectedProvider[];
  availableModels: AvailableModel[];
  chats: Chat[];
  activeChatId: string | null;
  isLoading: boolean;
  isExecuting: boolean;
  backendOnline: boolean;
}
