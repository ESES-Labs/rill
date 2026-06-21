/** Curated protocol addresses — verified via Sui RPC + official docs. */

const MAINNET = {
  cetus: {
    scriptPackageId: '0x3a5aa90ffa33d09100d7b6941ea1c0ffe6ab66e77062ddd26320c1b073aabb10',
    clmmPackageId: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
    globalConfigId: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
    defaultPoolId: '0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105',
    defaultInputCoinType: '0x2::sui::SUI',
    defaultCoinTypeA: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    defaultCoinTypeB: '0x2::sui::SUI',
    minSqrtPrice: '4295048016',
    maxSqrtPrice: '79226673515401279992447579055',
  },
  haedal: {
    packageId: '0x126e4cfb051cad744706df590ec399e8c02b6feae195c35b8b496280d5442a62',
    suiSystemStateId: '0x5',
    stakingObjectId: '0x47b224762220393057ebf4f70501b6e657c3e56684737568439a04f80849b2ca',
  },
} as const;

const TESTNET = {
  cetus: MAINNET.cetus, // Cetus testnet IDs differ; swap node uses mainnet for now
  haedal: {
    packageId: '0x0a6ff2b974e08b65649d334c38db5ca046b78b4a5d892087740b9cdb3eb08e47',
    suiSystemStateId: '0x5',
    stakingObjectId: '0xb399662ac5d3973256a1e8629a913336449a2baa16847502ce6bdbf4a0003f07',
  },
} as const;

const network = (process.env.SUI_NETWORK || 'mainnet') as 'mainnet' | 'testnet';
const active = network === 'testnet' ? TESTNET : MAINNET;

export const CETUS = active.cetus;
export const HAEDAL = {
  ...active.haedal,
  stakeTarget: `${active.haedal.packageId}::interface::request_stake`,
  /** Haedal rejects stakes below 1 SUI (abort code 4). */
  minStakeMist: 1_000_000_000n,
} as const;

export const SUI_CLOCK_ID = '0x6';
export const SUI_NETWORK = network;

export const DEFAULT_SIMULATE_SENDER =
  process.env.SIMULATE_SENDER ||
  '0x8d0a6aff4a9240af7b7e378ccfacd1cc94c107fc1745a1afcb9b529bef7b61c4';
