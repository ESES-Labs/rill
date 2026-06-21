import { Transaction } from '@mysten/sui/transactions';
import { CETUS, HAEDAL, SUI_CLOCK_ID } from '../../core/protocols';
import { pickSwapFunction, resolvePoolTypeArgs } from './pool-resolver';

export interface FlowNode {
  id: string;
  type: string;
  config?: Record<string, any>;
  inputs?: Record<string, any>;
}

export interface FlowEdge {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export class CompilerService {
  async compileFlow(flow: FlowGraph): Promise<{ transaction: Transaction; warnings: string[] }> {
    const tx = new Transaction();
    const warnings: string[] = [];
    const orderedNodes = this.topologicalSort(flow.nodes, flow.edges);
    const nodeOutputs: Record<string, unknown> = {};

    for (const node of orderedNodes) {
      if (node.type === 'cetus_swap') {
        const amountIn = BigInt(node.inputs?.amount_in ?? node.config?.amount_in ?? 0);
        const minAmountOut = BigInt(node.inputs?.min_amount_out ?? node.config?.min_amount_out ?? 0);
        const poolId = node.inputs?.pool ?? node.config?.pool ?? CETUS.defaultPoolId;
        const inputCoinType = node.config?.inputCoinType ?? CETUS.defaultInputCoinType;

        const poolTypes = await resolvePoolTypeArgs(poolId);
        const swap = pickSwapFunction(inputCoinType, poolTypes);

        const coinInputEdge = flow.edges.find(
          (e) => e.target === node.id && e.targetHandle === 'coin_inputs',
        );
        let coinInputArg;

        if (coinInputEdge) {
          coinInputArg = nodeOutputs[coinInputEdge.source];
        } else {
          const [splitCoin] = tx.splitCoins(tx.gas, [amountIn]);
          coinInputArg = splitCoin;
        }

        const result = tx.moveCall({
          target: `${CETUS.scriptPackageId}::${swap.module}::${swap.function}`,
          typeArguments: swap.typeArguments,
          arguments: [
            tx.object(CETUS.globalConfigId),
            tx.object(poolId),
            tx.makeMoveVec({ elements: [coinInputArg] }),
            tx.pure.bool(node.config?.by_amount_in ?? true),
            tx.pure.u64(amountIn),
            tx.pure.u64(minAmountOut),
            tx.pure.u128(BigInt(node.config?.sqrt_price_limit ?? swap.sqrtPriceLimit)),
            tx.object(SUI_CLOCK_ID),
          ],
        });

        nodeOutputs[node.id] = result;
      } else if (node.type === 'haedal_stake') {
        const amount = BigInt(node.inputs?.amount ?? node.config?.amount ?? 0);

        if (amount < HAEDAL.minStakeMist) {
          throw new Error(
            `Haedal minimum stake is ${HAEDAL.minStakeMist} mist (1 SUI). Got ${amount}.`,
          );
        }

        const coinInputEdge = flow.edges.find(
          (e) => e.target === node.id && e.targetHandle === 'sui_coin',
        );
        let coinInputArg;

        if (coinInputEdge) {
          coinInputArg = nodeOutputs[coinInputEdge.source];
        } else {
          const [splitCoin] = tx.splitCoins(tx.gas, [amount]);
          coinInputArg = splitCoin;
        }

        tx.moveCall({
          target: HAEDAL.stakeTarget,
          typeArguments: [],
          arguments: [
            tx.object(HAEDAL.suiSystemStateId),
            tx.object(HAEDAL.stakingObjectId),
            coinInputArg,
            tx.pure.address(node.config?.validator ?? '0x0'),
          ],
        });
      } else {
        warnings.push(
          `Node type "${node.type}" is not supported by the current compiler version and was skipped.`,
        );
      }
    }

    return { transaction: tx, warnings };
  }

  private topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: FlowNode[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const adj = new Map<string, string[]>();

    for (const edge of edges) {
      if (!adj.has(edge.source)) adj.set(edge.source, []);
      adj.get(edge.source)!.push(edge.target);
    }

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error('Cyclic dependency detected in flow wiring!');
      }
      if (!visited.has(nodeId)) {
        temp.add(nodeId);
        for (const neighbor of adj.get(nodeId) || []) {
          if (nodeMap.has(neighbor)) visit(neighbor);
        }
        temp.delete(nodeId);
        visited.add(nodeId);
        const node = nodeMap.get(nodeId);
        if (node) order.unshift(node);
      }
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) visit(node.id);
    }

    return order;
  }
}

export const compilerService = new CompilerService();
