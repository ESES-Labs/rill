import { config } from '../../core/config';
import { loadAgentWalletFromEnv, type AgentWalletBinding } from '../../core/agent-wallet';
import {
  compilerService,
  type FlowGraph,
  type CompileOptions,
} from '../compiler/compiler.service';
import { previewService } from '../compiler/preview.service';
import { serializeUnsignedPtb } from '../compiler/ptb.util';
import { simulatorService, type SimulationResult } from '../compiler/simulator.service';
import { canExecuteOnChain, loadExecutorKeypair } from './sui-signer';
import {
  walrusAuditService,
  type AuditRecord,
  type WalrusAuditRef,
} from '../walrus/audit.service';

export interface SkillRunResult {
  unsignedPtb: string;
  preview: string;
  simulation: SimulationResult;
  executed: boolean;
  digest?: string;
  warnings: string[];
  agentWalletBound: boolean;
  /** Backend is keyless — client (Thiny / wallet) must sign unsignedPtb. */
  signable: true;
  devSignAvailable: boolean;
  walrus?: WalrusAuditRef;
}

export interface RunFlowOptions {
  execute?: boolean;
  sender?: string;
  forceExecute?: boolean;
  agentWallet?: AgentWalletBinding;
}

export class SkillRunnerService {
  async runFlow(
    flow: FlowGraph,
    params: Record<string, unknown>,
    options: RunFlowOptions = {},
  ): Promise<SkillRunResult> {
    const hydratedFlow = this.applyParams(flow, params);
    const compileOpts = this.resolveCompileOptions(options);
    const { transaction, warnings, agentWalletBound } =
      await compilerService.compileFlow(hydratedFlow, compileOpts);

    const preview = previewService.buildPreview(hydratedFlow, warnings);
    const unsignedPtb = serializeUnsignedPtb(transaction);

    const simulation = await simulatorService.simulateTransaction(
      transaction,
      compileOpts.sender,
    );

    if (simulation.simulatedViaFallback) {
      warnings.push(
        'Cetus devInspect skipped package version check — simulation estimated; mainnet execute should still work.',
      );
    }

    const devSignAvailable = config.devSignEnabled && canExecuteOnChain();
    const wantsExecute = options.execute === true;

    if (!wantsExecute) {
      return this.finalizeResult(
        {
          unsignedPtb,
          preview,
          simulation,
          executed: false,
          warnings,
          agentWalletBound,
          signable: true,
          devSignAvailable,
        },
        hydratedFlow,
        params,
        devSignAvailable,
      );
    }

    if (!devSignAvailable) {
      throw new Error(
        'Server-side signing is disabled (keyless mode). Sign unsignedPtb locally via Thiny or set DEV_SIGN_ENABLED=true for dev only.',
      );
    }

    if (!simulation.ok && !options.forceExecute) {
      throw new Error(`Simulation failed: ${simulation.error ?? 'unknown error'}`);
    }

    const digest = await this.executeTransaction(transaction, compileOpts.sender);
    return this.finalizeResult(
      {
        unsignedPtb,
        preview,
        simulation,
        executed: true,
        digest,
        warnings,
        agentWalletBound,
        signable: true,
        devSignAvailable,
      },
      hydratedFlow,
      params,
      devSignAvailable,
    );
  }

  private resolveCompileOptions(options: RunFlowOptions): CompileOptions {
    const agentWallet = options.agentWallet ?? loadAgentWalletFromEnv();
    const sender =
      options.sender ??
      process.env.SIMULATE_SENDER ??
      (canExecuteOnChain() && config.devSignEnabled
        ? loadExecutorKeypair().getPublicKey().toSuiAddress()
        : undefined);

    return { sender, agentWallet };
  }

  private async finalizeResult(
    result: SkillRunResult,
    flow: FlowGraph,
    params: Record<string, unknown>,
    allowWalrus: boolean,
  ): Promise<SkillRunResult> {
    if (!allowWalrus || !config.walrusEnabled) {
      return result;
    }

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
    if (!walrus) {
      result.warnings.push(
        'Walrus audit upload skipped or failed — enable DEV_SIGN + WALRUS for server uploads, or audit via Thiny.',
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

  private async executeTransaction(tx: import('@mysten/sui/transactions').Transaction, sender?: string): Promise<string> {
    const keypair = loadExecutorKeypair();
    const address = sender ?? keypair.getPublicKey().toSuiAddress();
    tx.setSender(address);

    const { suiClient } = await import('../../core/config');
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
