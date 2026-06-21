import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import dotenv from 'dotenv';

dotenv.config();

const network = (process.env.SUI_NETWORK || 'mainnet') as 'mainnet' | 'testnet';
const DEFAULT_RPC = getJsonRpcFullnodeUrl(network);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  network,
  suiRpcUrl: process.env.SUI_RPC_URL || DEFAULT_RPC,
  mainnetRpcUrl: process.env.SUI_MAINNET_RPC_URL || getJsonRpcFullnodeUrl('mainnet'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${parseInt(process.env.PORT || '3000', 10)}`,
  walrusEnabled: (process.env.WALRUS_ENABLED || 'false').toLowerCase() === 'true',
  walrusUploadRelay:
    process.env.WALRUS_UPLOAD_RELAY || 'https://upload-relay.testnet.walrus.space',
  walrusEpochs: parseInt(process.env.WALRUS_EPOCHS || '3', 10),
  walrusMaxTipMist: parseInt(process.env.WALRUS_MAX_TIP_MIST || '5000000', 10),
  walrusExplorerBase:
    process.env.WALRUS_EXPLORER_BASE || 'https://walruscan.com/testnet/blob',
};

export const suiClient = new SuiJsonRpcClient({ url: config.suiRpcUrl, network: config.network });
export const mainnetSuiClient = new SuiJsonRpcClient({ url: config.mainnetRpcUrl, network: 'mainnet' });
