import { Transaction } from '@mysten/sui/transactions';
import { suiClient } from '../../core/config';
import { loadExecutorKeypair } from './sui-signer';
import { compilerService, FlowGraph } from '../compiler/compiler.service';
import { simulatorService, SimulationResult } from '../compiler/simulator.service';

export interface SkillRunResult {
  simulation: SimulationResult;
  executed: boolean;
  digest?: string;
  warnings: string[];
}

export class SkillRunnerService {
  async runFlow(
    flow: FlowGraph,
    params: Record<string, unknown>,
    options: { execute?: boolean; sender?: string; forceExecute?: boolean } = {},
  ): Promise<SkillRunResult> {
    const hydratedFlow = this.applyParams(flow, params);
    const { transaction, warnings } = await compilerService.compileFlow(hydratedFlow);

    const simulation = await simulatorService.simulateTransaction(
      transaction,
      options.sender,
    );

    if (simulation.simulatedViaFallback) {
      warnings.push(
        'Cetus devInspect skipped package version check — simulation estimated; mainnet execute should still work.',
      );
    }

    if (!options.execute) {
      return { simulation, executed: false, warnings };
    }

    if (!simulation.ok && !options.forceExecute) {
      throw new Error(`Simulation failed: ${simulation.error ?? 'unknown error'}`);
    }

    const digest = await this.executeTransaction(transaction, options.sender);
    return { simulation, executed: true, digest, warnings };
  }

  private applyParams(flow: FlowGraph, params: Record<string, unknown>): FlowGraph {
    return {
      ...flow,
      nodes: flow.nodes.map((node) => ({
        ...node,
        inputs: {
          ...(node.inputs ?? {}),
          ...Object.fromEntries(
            Object.entries(params).filter(([key]) => {
              if (node.type === 'cetus_swap') {
                return ['amount_in', 'min_amount_out', 'pool'].includes(key);
              }
              if (node.type === 'haedal_stake') {
                return ['amount'].includes(key);
              }
              return false;
            }),
          ),
        },
      })),
    };
  }

  private async executeTransaction(tx: Transaction, sender?: string): Promise<string> {
    const keypair = loadExecutorKeypair();

    const address = sender ?? keypair.getPublicKey().toSuiAddress();
    tx.setSender(address);

    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(result.effects?.status.error ?? 'Transaction execution failed');
    }

    return result.digest;
  }
}

export const skillRunnerService = new SkillRunnerService();
