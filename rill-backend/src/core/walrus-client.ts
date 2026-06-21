import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
import { config } from './config';

export function createWalrusClient() {
  return new SuiGrpcClient({
    network: config.network,
    baseUrl: config.suiRpcUrl,
  }).$extend(
    walrus({
      uploadRelay: {
        host: config.walrusUploadRelay,
        sendTip: { max: config.walrusMaxTipMist },
      },
    }),
  );
}

export type WalrusClient = ReturnType<typeof createWalrusClient>;
