import { suiClient } from '../../core/config';
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
}

export class SimulatorService {
  /**
   * Simulates a transaction block using devInspect.
   */
  async simulateTransaction(tx: Transaction, sender?: string): Promise<SimulationResult> {
    const dummySender = sender || '0xd1552a4a3cf5f08ab6d91cd4a553018260408544c2053f3e691232822a1060a';
    
    try {
      const response = await suiClient.devInspectTransactionBlock({
        sender: dummySender,
        transactionBlock: tx,
      });

      const res = response as any;

      const ok = response.effects.status.status === 'success';
      const error = ok ? undefined : response.effects.status.error;

      // Extract gas estimate
      const computationCost = parseInt(response.effects.gasUsed.computationCost, 10);
      const storageCost = parseInt(response.effects.gasUsed.storageCost, 10);
      const storageRebate = parseInt(response.effects.gasUsed.storageRebate, 10);
      const gasEstimate = computationCost + Math.max(0, storageCost - storageRebate);

      // Parse balance changes
      const balanceChanges = (res.balanceChanges || []).map((change: any) => ({
        owner: typeof change.owner === 'object' && change.owner.AddressOwner ? change.owner.AddressOwner : JSON.stringify(change.owner),
        coinType: change.coinType,
        amount: change.amount,
      }));

      // Parse object changes
      const objectChanges = (res.objectChanges || []).map((change: any) => ({
        type: change.type as 'mutated' | 'created' | 'deleted',
        objectId: change.objectId || '',
        objectType: change.objectType || '',
      })).filter((c: any) => c.objectId);

      return {
        ok,
        error,
        gasEstimate,
        balanceChanges,
        objectChanges,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Unknown RPC simulation error',
        gasEstimate: 0,
        balanceChanges: [],
        objectChanges: [],
      };
    }
  }
}

export const simulatorService = new SimulatorService();
