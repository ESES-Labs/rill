import { existsSync, readFileSync } from 'node:fs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import {
  decodeSuiPrivateKey,
  SIGNATURE_FLAG_TO_SCHEME,
  type SignatureScheme,
} from '@mysten/sui/cryptography';
import type { Keypair } from '@mysten/sui/cryptography';

const DEFAULT_KEYSTORE = `${process.env.HOME}/.sui/sui_config/sui.keystore`;
const DEFAULT_CLIENT_CONFIG = `${process.env.HOME}/.sui/sui_config/client.yaml`;

export function canExecuteOnChain(): boolean {
  if (process.env.EXECUTOR_PRIVATE_KEY) return true;
  const keystore = process.env.SUI_KEYSTORE_PATH || DEFAULT_KEYSTORE;
  return existsSync(keystore);
}

function keypairFromSchemeAndSecret(scheme: SignatureScheme, secretKey: Uint8Array): Keypair {
  switch (scheme) {
    case 'ED25519':
      return Ed25519Keypair.fromSecretKey(secretKey);
    case 'Secp256k1':
      return Secp256k1Keypair.fromSecretKey(secretKey);
    case 'Secp256r1':
      return Secp256r1Keypair.fromSecretKey(secretKey);
    default:
      throw new Error(`Unsupported key scheme in keystore: ${scheme}`);
  }
}

function parseKeystoreEntry(entry: string): Keypair {
  if (entry.startsWith('suiprivkey')) {
    const { scheme, secretKey } = decodeSuiPrivateKey(entry);
    return keypairFromSchemeAndSecret(scheme, secretKey);
  }

  const bytes = Buffer.from(entry, 'base64');
  if (bytes.length < 33) {
    throw new Error('Invalid keystore entry: expected base64 flag||privkey (33 bytes)');
  }

  const flag = bytes[0];
  const scheme = SIGNATURE_FLAG_TO_SCHEME[flag as keyof typeof SIGNATURE_FLAG_TO_SCHEME];
  if (!scheme) {
    throw new Error(`Unknown signature flag in keystore: ${flag}`);
  }

  return keypairFromSchemeAndSecret(scheme, bytes.slice(1));
}

function resolveExecutorAddress(): string | undefined {
  if (process.env.EXECUTOR_ADDRESS) {
    return process.env.EXECUTOR_ADDRESS;
  }

  const clientConfig = process.env.SUI_CLIENT_CONFIG || DEFAULT_CLIENT_CONFIG;
  if (!existsSync(clientConfig)) {
    return undefined;
  }

  const match = readFileSync(clientConfig, 'utf8').match(/^active_address:\s*"?([^"\n]+)"?/m);
  return match?.[1];
}

/** Load signer from EXECUTOR_PRIVATE_KEY or local Sui CLI keystore (never logged). */
export function loadExecutorKeypair(): Keypair {
  const inlineKey = process.env.EXECUTOR_PRIVATE_KEY;
  if (inlineKey) {
    if (inlineKey.startsWith('suiprivkey')) {
      const { scheme, secretKey } = decodeSuiPrivateKey(inlineKey);
      return keypairFromSchemeAndSecret(scheme, secretKey);
    }
    return Ed25519Keypair.fromSecretKey(inlineKey);
  }

  const keystorePath = process.env.SUI_KEYSTORE_PATH || DEFAULT_KEYSTORE;
  const entries: string[] = JSON.parse(readFileSync(keystorePath, 'utf8'));
  if (!entries.length) {
    throw new Error(`No keys found in keystore: ${keystorePath}`);
  }

  const targetAddress = resolveExecutorAddress();
  const keypairs = entries.map(parseKeystoreEntry);

  if (targetAddress) {
    const matched = keypairs.find((kp) => kp.getPublicKey().toSuiAddress() === targetAddress);
    if (matched) return matched;
    throw new Error(`No keystore key matches active address ${targetAddress}`);
  }

  return keypairs[0];
}
