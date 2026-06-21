import { Transaction } from '@mysten/sui/transactions';

/** Base64-encoded BCS transaction bytes — sign locally (Thiny / wallet). */
export function serializeUnsignedPtb(tx: Transaction): string {
  return Buffer.from(tx.serialize()).toString('base64');
}
