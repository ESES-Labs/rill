import { Transaction } from '@mysten/sui/transactions';

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
  /**
   * Compiles a flow graph into a Sui Transaction block.
   */
  compileFlow(flow: FlowGraph): { transaction: Transaction; warnings: string[] } {
    const tx = new Transaction();
    const warnings: string[] = [];
    
    // 1. Topological Sort of nodes based on edges
    const orderedNodes = this.topologicalSort(flow.nodes, flow.edges);
    
    // Map to store return values of compiled nodes: nodeID -> TransactionArgument
    const nodeOutputs: Record<string, any> = {};

    // 2. Compile each node in order
    for (const node of orderedNodes) {
      if (node.type === 'cetus_swap') {
        const amountIn = node.inputs?.amount_in ?? node.config?.amount_in ?? 0;
        const minAmountOut = node.inputs?.min_amount_out ?? node.config?.min_amount_out ?? 0;
        const poolId = node.inputs?.pool ?? node.config?.pool ?? '0x1eab09450fe65f08ab6d91cd4a553018260408544c2053f3e691232822a1060a';

        // Check if coin input is wired from a previous node
        const coinInputEdge = flow.edges.find(e => e.target === node.id && e.targetHandle === 'coin_inputs');
        let coinInputArg;

        if (coinInputEdge) {
          coinInputArg = nodeOutputs[coinInputEdge.source];
        } else {
          // If not wired, split from gas coin
          const [splitCoin] = tx.splitCoins(tx.gas, [amountIn]);
          coinInputArg = splitCoin;
        }

        // Target: 0x1eab09...::pool_script::swap_a2b
        const result = tx.moveCall({
          target: `${poolId.split('::')[0]}::pool_script::swap_a2b`,
          typeArguments: [
            node.config?.coinTypeA ?? '0x2::sui::SUI',
            node.config?.coinTypeB ?? '0x5497033c072c7e96b124119fa9d1d1f75e3e2b26::usdc::USDC'
          ],
          arguments: [
            tx.object('0x6'), // Clock
            tx.object(poolId), // Pool
            tx.makeMoveVec({ elements: [coinInputArg] }), // Vector of coins
            tx.pure.u64(amountIn),
            tx.pure.bool(true),
            tx.pure.u64(minAmountOut),
            tx.pure.u128('4295048016'), // price limit
          ],
        });

        nodeOutputs[node.id] = result;

      } else if (node.type === 'haedal_stake') {
        const amount = node.inputs?.amount ?? node.config?.amount ?? 0;
        const stakingWrapper = node.inputs?.staking_wrapper ?? node.config?.staking_wrapper ?? '0x587a6cd43685e1302a912a912a912a912a912a912a912a912a912a912a912a9::liquid_staking::StakingWrapper';

        // Check if SUI coin input is wired from a previous node
        const coinInputEdge = flow.edges.find(e => e.target === node.id && e.targetHandle === 'sui_coin');
        let coinInputArg;

        if (coinInputEdge) {
          coinInputArg = nodeOutputs[coinInputEdge.source];
        } else {
          const [splitCoin] = tx.splitCoins(tx.gas, [amount]);
          coinInputArg = splitCoin;
        }

        // Target: liquid_staking::request_stake
        const result = tx.moveCall({
          target: `0x587a6cd43685e1302a912a912a912a912a912a912a912a912a912a912a912a9::liquid_staking::request_stake`,
          typeArguments: [],
          arguments: [
            tx.object(stakingWrapper),
            tx.object('0x6'), // Clock
            coinInputArg,
            tx.pure.u64(amount)
          ]
        });

        nodeOutputs[node.id] = result;

      } else {
        warnings.push(`Node type "${node.type}" is not supported by the current compiler version and was skipped.`);
      }
    }

    return { transaction: tx, warnings };
  }

  /**
   * Performs a topological sort of nodes based on connection edges.
   */
  private topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: FlowNode[] = [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build adjacency list (source -> targets)
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
        const neighbors = adj.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (nodeMap.has(neighbor)) {
            visit(neighbor);
          }
        }
        temp.delete(nodeId);
        visited.add(nodeId);
        const node = nodeMap.get(nodeId);
        if (node) {
          order.unshift(node);
        }
      }
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return order.reverse();
  }
}

export const compilerService = new CompilerService();
