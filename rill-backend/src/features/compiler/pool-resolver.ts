import { suiClient } from '../../core/config';

export interface PoolTypeArgs {
  coinTypeA: string;
  coinTypeB: string;
}

/** Parse `Pool<T0, T1>` from on-chain pool object type. */
export async function resolvePoolTypeArgs(poolId: string): Promise<PoolTypeArgs> {
  const obj = await suiClient.getObject({ id: poolId, options: { showType: true } });
  const poolType = obj.data?.type;
  if (!poolType) {
    throw new Error(`Pool object ${poolId} not found`);
  }

  const match = poolType.match(/Pool<([^,]+),\s*([^>]+)>/);
  if (!match) {
    throw new Error(`Cannot parse pool type: ${poolType}`);
  }

  return { coinTypeA: match[1].trim(), coinTypeB: match[2].trim() };
}

/** swap_a2b = T0→T1, swap_b2a = T1→T0 */
export function pickSwapFunction(inputCoinType: string, pool: PoolTypeArgs): {
  module: 'pool_script';
  function: 'swap_a2b' | 'swap_b2a';
  typeArguments: [string, string];
  sqrtPriceLimit: string;
} {
  const isA2B = inputCoinType === pool.coinTypeA;
  return {
    module: 'pool_script',
    function: isA2B ? 'swap_a2b' : 'swap_b2a',
    typeArguments: [pool.coinTypeA, pool.coinTypeB],
    sqrtPriceLimit: isA2B ? '4295048016' : '79226673515401279992447579055',
  };
}
