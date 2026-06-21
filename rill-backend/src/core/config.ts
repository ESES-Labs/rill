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
};

export const suiClient = new SuiJsonRpcClient({ url: config.suiRpcUrl, network: config.network });
export const mainnetSuiClient = new SuiJsonRpcClient({ url: config.mainnetRpcUrl, network: 'mainnet' });
