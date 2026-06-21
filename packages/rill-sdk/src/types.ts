export interface FlowEdge {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface FlowNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  type?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface IntrospectFunction {
  moduleName: string;
  functionName: string;
  parameters: unknown[];
  returnTypes: unknown[];
}

export interface ResolvedManifest {
  packageId: string;
  module: string;
  functionName: string;
  parameters: unknown[];
  [key: string]: unknown;
}

export interface SimulationResult {
  ok: boolean;
  error?: string;
  gasEstimate: number;
  balanceChanges: {
    owner: string;
    coinType: string;
    amount: string;
  }[];
  objectChanges: {
    type: 'mutated' | 'created' | 'deleted';
    objectId: string;
    objectType: string;
  }[];
  simulatedViaFallback?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface PublishedSkill {
  id: string;
  name: string;
  description: string;
  mcpUrl: string;
  toolDefs: ToolDef;
  createdAt: string;
}

export interface PublishResult {
  skillId: string;
  mcpUrl: string;
  toolDefs: ToolDef;
  warnings: string[];
}

export interface SkillRunResult {
  simulation: SimulationResult;
  executed: boolean;
  digest?: string;
  warnings: string[];
}

export interface HealthInfo {
  name: string;
  status: string;
  version: string;
  network?: string;
  apiBase?: string;
}

export interface McpToolCallResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}
