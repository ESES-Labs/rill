import { RillApiError } from './errors';
import type {
  ApiResponse,
  FlowGraph,
  HealthInfo,
  IntrospectFunction,
  McpToolCallResult,
  PublishResult,
  PublishedSkill,
  ResolvedManifest,
  SimulationResult,
  SkillRunResult,
} from './types';

export type RillClientOptions = {
  /** e.g. http://localhost:3002/api */
  baseUrl: string;
  fetch?: typeof fetch;
};

export class RillClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: RillClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetch ?? fetch;
  }

  async health(): Promise<HealthInfo> {
    const root = this.baseUrl.replace(/\/api$/, '');
    const res = await this.fetchFn(root);
    return res.json() as Promise<HealthInfo>;
  }

  introspect(packageId: string): Promise<IntrospectFunction[]> {
    return this.post('/introspect', { packageId });
  }

  resolve(packageId: string, moduleName: string, functionName: string): Promise<ResolvedManifest> {
    return this.post('/resolve', { packageId, moduleName, functionName });
  }

  compile(flow: FlowGraph): Promise<{ txBytes: string; warnings: string[] }> {
    return this.post('/compile', { flow });
  }

  simulate(flow: FlowGraph): Promise<{ simulation: SimulationResult; warnings: string[] }> {
    return this.post('/simulate', { flow });
  }

  publish(flow: FlowGraph, policyId?: string): Promise<PublishResult> {
    return this.post('/publish', { flow, policyId });
  }

  listSkills(): Promise<PublishedSkill[]> {
    return this.get('/skills');
  }

  execute(options: {
    flow?: FlowGraph;
    skillId?: string;
    params?: Record<string, unknown>;
    execute?: boolean;
    forceExecute?: boolean;
  }): Promise<SkillRunResult> {
    return this.post('/execute', options);
  }

  /** MCP JSON-RPC tools/call */
  async callSkill(
    skillId: string,
    arguments_: Record<string, unknown>,
    requestId: number | string = 1,
  ): Promise<SkillRunResult> {
    const result = await this.postJsonRpc<McpToolCallResult>(`/mcp/${skillId}`, {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: { arguments: arguments_ },
    });

    const text = result.content?.[0]?.text;
    if (!text) {
      throw new RillApiError('Empty MCP response', 500);
    }

    return JSON.parse(text) as SkillRunResult;
  }

  /** MCP JSON-RPC tools/list */
  listTools(skillId: string, requestId: number | string = 1) {
    return this.postJsonRpc<{ tools: unknown[] }>(`/mcp/${skillId}`, {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/list',
    });
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`);
    return this.parseResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this.parseResponse<T>(res);
  }

  private async postJsonRpc<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as { result?: T; error?: { message: string; code: number } };

    if (json.error) {
      throw new RillApiError(json.error.message, res.status, 'McpError');
    }

    if (!json.result) {
      throw new RillApiError('Missing MCP result', res.status);
    }

    return json.result;
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const json = (await res.json()) as ApiResponse<T>;

    if (!res.ok || !json.success) {
      const err = json as { error?: string; type?: string };
      throw new RillApiError(err.error ?? `HTTP ${res.status}`, res.status, err.type);
    }

    return json.data;
  }
}
