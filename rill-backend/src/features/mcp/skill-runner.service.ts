import { Transaction } from '@mysten/sui/transactions';
import { suiClient } from '../../core/config';
import { loadExecutorKeypair } from './sui-signer';
import { compilerService, FlowGraph } from '../compiler/compiler.service';
import { simulatorService, SimulationResult } from '../compiler/simulator.service';
import {
  walrusAuditService,
  type AuditRecord,
  type WalrusAuditRef,
} from '../walrus/audit.service';

export interface SkillRunResult {
  simulation: SimulationResult;
  executed: boolean;
  digest?: string;
  warnings: string[];
  walrus?: WalrusAuditRef;
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
      return this.finalizeResult(
        { simulation, executed: false, warnings },
        hydratedFlow,
        params,
      );
    }

    if (!simulation.ok && !options.forceExecute) {
      throw new Error(`Simulation failed: ${simulation.error ?? 'unknown error'}`);
    }

    const digest = await this.executeTransaction(transaction, options.sender);
    return this.finalizeResult(
      { simulation, executed: true, digest, warnings },
      hydratedFlow,
      params,
    );
  }

  private async finalizeResult(
    result: Omit<SkillRunResult, 'walrus'>,
    flow: FlowGraph,
    params: Record<string, unknown>,
  ): Promise<SkillRunResult> {
    const audit: AuditRecord = {
      version: '1',
      service: 'rill',
      network: process.env.SUI_NETWORK || 'testnet',
      timestamp: new Date().toISOString(),
      flow,
      params,
      simulation: result.simulation,
      executed: result.executed,
      digest: result.digest,
      warnings: result.warnings,
    };

    const walrus = await walrusAuditService.storeAuditTrail(audit);
    if (walrusAuditService.isEnabled() && !walrus) {
      result.warnings.push(
        'Walrus audit upload skipped or failed — check WALRUS_ENABLED and executor wallet (SUI + WAL on testnet).',
      );
    }

    return { ...result, walrus };
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
