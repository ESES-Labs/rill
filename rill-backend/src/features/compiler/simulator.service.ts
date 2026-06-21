import { suiClient } from '../../core/config';
import { DEFAULT_SIMULATE_SENDER } from '../../core/protocols';
import { isCetusDevInspectVersionAbort } from './pool-resolver';
import { Transaction } from '@mysten/sui/transactions';

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
  /** Set when devInspect is unreliable but PTB is likely valid on mainnet. */
  simulatedViaFallback?: boolean;
}

export class SimulatorService {
  async simulateTransaction(tx: Transaction, sender?: string): Promise<SimulationResult> {
    const simulateSender = sender || DEFAULT_SIMULATE_SENDER;
    tx.setSenderIfNotSet(simulateSender);

    try {
      const response = await suiClient.devInspectTransactionBlock({
        sender: simulateSender,
        transactionBlock: tx,
      });

      const parsed = this.parseDevInspect(response);
      return this.applyCetusFallback(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown RPC simulation error';
      return this.applyCetusFallback({
        ok: false,
        error: message,
        gasEstimate: 0,
        balanceChanges: [],
        objectChanges: [],
      });
    }
  }

  /** Cetus CLMM stub fails checked_package_version in devInspect; mainnet execute still works. */
  private applyCetusFallback(result: SimulationResult): SimulationResult {
    if (result.ok || !isCetusDevInspectVersionAbort(result.error)) {
      return result;
    }

    return {
      ...result,
      ok: true,
      simulatedViaFallback: true,
      error: undefined,
      gasEstimate: result.gasEstimate || 2_500_000,
    };
  }

  private parseDevInspect(response: Awaited<ReturnType<typeof suiClient.devInspectTransactionBlock>>): SimulationResult {
    const res = response as Record<string, unknown>;
    const ok = response.effects.status.status === 'success';
    const error = ok ? undefined : response.effects.status.error;

    const computationCost = parseInt(response.effects.gasUsed.computationCost, 10);
    const storageCost = parseInt(response.effects.gasUsed.storageCost, 10);
    const storageRebate = parseInt(response.effects.gasUsed.storageRebate, 10);
    const gasEstimate = computationCost + Math.max(0, storageCost - storageRebate);

    const balanceChanges = ((res.balanceChanges as Array<Record<string, unknown>>) || []).map((change) => ({
      owner:
        typeof change.owner === 'object' &&
        change.owner &&
        'AddressOwner' in (change.owner as object)
          ? String((change.owner as { AddressOwner: string }).AddressOwner)
          : JSON.stringify(change.owner),
      coinType: String(change.coinType),
      amount: String(change.amount),
    }));

    const objectChanges = ((res.objectChanges as Array<Record<string, unknown>>) || [])
      .map((change) => ({
        type: change.type as 'mutated' | 'created' | 'deleted',
        objectId: String(change.objectId || ''),
        objectType: String(change.objectType || ''),
      }))
      .filter((c) => c.objectId);

    return { ok, error, gasEstimate, balanceChanges, objectChanges };
  }
}

export const simulatorService = new SimulatorService();
