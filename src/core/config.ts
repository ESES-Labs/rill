import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_TESTNET_RPC = getJsonRpcFullnodeUrl('testnet');
const DEFAULT_MAINNET_RPC = getJsonRpcFullnodeUrl('mainnet');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  suiRpcUrl: process.env.SUI_RPC_URL || DEFAULT_TESTNET_RPC,
  mainnetRpcUrl: process.env.SUI_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC,
};

// Default JSON-RPC client
export const suiClient = new SuiJsonRpcClient({ url: config.suiRpcUrl, network: 'testnet' });

// Mainnet client for semantic harvesting
export const mainnetSuiClient = new SuiJsonRpcClient({ url: config.mainnetRpcUrl, network: 'mainnet' });
