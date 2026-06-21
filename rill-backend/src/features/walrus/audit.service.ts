import { config } from '../../core/config';
import { createWalrusClient } from '../../core/walrus-client';
import { canExecuteOnChain, loadExecutorKeypair } from '../mcp/sui-signer';
import type { FlowGraph } from '../compiler/compiler.service';
import type { SimulationResult } from '../compiler/simulator.service';

export interface AuditRecord {
  version: '1';
  service: 'rill';
  network: string;
  timestamp: string;
  flow: FlowGraph;
  params?: Record<string, unknown>;
  simulation: SimulationResult;
  executed: boolean;
  digest?: string;
  warnings: string[];
}

export interface WalrusAuditRef {
  blobId: string;
  explorerUrl: string;
}

export class WalrusAuditService {
  isEnabled(): boolean {
    return config.walrusEnabled;
  }

  async storeAuditTrail(record: AuditRecord): Promise<WalrusAuditRef | undefined> {
    if (!config.walrusEnabled) {
      return undefined;
    }

    if (!canExecuteOnChain()) {
      console.warn('Walrus audit skipped: no executor keypair configured');
      return undefined;
    }

    try {
      const signer = loadExecutorKeypair();
      const client = createWalrusClient();
      const blob = new TextEncoder().encode(JSON.stringify(record, null, 2));

      const { blobId } = await client.walrus.writeBlob({
        blob,
        deletable: true,
        epochs: config.walrusEpochs,
        signer,
      });

      return {
        blobId,
        explorerUrl: `${config.walrusExplorerBase}/${blobId}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Walrus audit upload failed: ${message}`);
      return undefined;
    }
  }

  async readAuditTrail(blobId: string): Promise<AuditRecord> {
    const client = createWalrusClient();
    const bytes = await client.walrus.readBlob({ blobId });
    return JSON.parse(new TextDecoder().decode(bytes)) as AuditRecord;
  }
}

export const walrusAuditService = new WalrusAuditService();
