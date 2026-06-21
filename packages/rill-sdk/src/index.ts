export { RillClient, type RillClientOptions } from './client';
export { RillApiError } from './errors';
export type {
  ApiError,
  ApiResponse,
  ApiSuccess,
  FlowEdge,
  FlowGraph,
  FlowNode,
  HealthInfo,
  IntrospectFunction,
  McpToolCallResult,
  PublishResult,
  PublishedSkill,
  ResolvedManifest,
  SimulationResult,
  SkillRunResult,
  ToolDef,
} from './types';

import type { FlowGraph } from './types';

/** Preset node types supported by the compiler today. */
export const NODE_TYPES = {
  CETUS_SWAP: 'cetus_swap',
  HAEDAL_STAKE: 'haedal_stake',
} as const;

/** Helper: single-node Haedal stake flow. */
export function haedalStakeFlow(amountMist: number | bigint, nodeId = 'h1'): FlowGraph {
  return {
    nodes: [{ id: nodeId, type: NODE_TYPES.HAEDAL_STAKE, inputs: { amount: Number(amountMist) } }],
    edges: [],
  };
}

/** Helper: single-node Cetus swap flow (mainnet). */
export function cetusSwapFlow(
  amountInMist: number | bigint,
  options: { minAmountOut?: number | bigint; pool?: string; inputCoinType?: string } = {},
  nodeId = 's1',
): FlowGraph {
  return {
    nodes: [
      {
        id: nodeId,
        type: NODE_TYPES.CETUS_SWAP,
        inputs: {
          amount_in: Number(amountInMist),
          min_amount_out: Number(options.minAmountOut ?? 0),
          ...(options.pool ? { pool: options.pool } : {}),
        },
        ...(options.inputCoinType ? { config: { inputCoinType: options.inputCoinType } } : {}),
      },
    ],
    edges: [],
  };
}
