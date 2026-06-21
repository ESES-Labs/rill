#!/usr/bin/env bun
/**
 * agent_wallet — live testnet battle-test (reproducible).
 *
 * Drives every path against the DEPLOYED contract and asserts real on-chain outcomes:
 * create → spend(ok) → over-per-tx(abort 4) → bad-cap(abort 6) → revoke(reclaim) →
 * spend-after-revoke(abort 2) → expiry(abort 3). Aborts are REAL failed txs (digest + MoveAbort code),
 * not dry-runs. Reclaims locked funds at the end.
 *
 * Env: RILL_SUI_PRIVATE_KEY (suiprivkey1…), AGENT_WALLET_PACKAGE_ID, SUI_NETWORK (testnet).
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const PKG = process.env.AGENT_WALLET_PACKAGE_ID!;
const SECRET = process.env.RILL_SUI_PRIVATE_KEY!;
const NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet';
const CLOCK = '0x6';
const SUI = '0x2::sui::SUI';
if (!PKG || !SECRET) throw new Error('Set AGENT_WALLET_PACKAGE_ID and RILL_SUI_PRIVATE_KEY');

const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK });
const kp = Ed25519Keypair.fromSecretKey(SECRET);
const ME = kp.getPublicKey().toSuiAddress();

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label} ${detail}`); }
  else { failed++; console.log(`  ❌ ${label} ${detail}`); }
}

function abortCode(err?: string): number | null {
  if (!err) return null;
  const m = err.match(/MoveAbort\([^)]*?,\s*(\d+)\)/) || err.match(/,\s*(\d+)\)\s*in command/);
  return m ? Number(m[1]) : null;
}

async function run(tx: Transaction, label: string): Promise<{ digest: string; ok: boolean; err?: string; result: Awaited<ReturnType<typeof client.signAndExecuteTransaction>> }> {
  tx.setSender(ME);
  // Explicit gas budget skips the SDK's auto dry-run, so expected-failure txs actually submit
  // (and land on-chain as real failed txs with a MoveAbort code) instead of throwing at resolution.
  tx.setGasBudget(20_000_000);
  const result = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: result.digest });
  const status = result.effects?.status;
  const ok = status?.status === 'success';
  console.log(`  · ${label}: ${ok ? 'success' : 'failure'} (${result.digest})`);
  return { digest: result.digest, ok, err: status?.error, result };
}

function createdIds(result: Awaited<ReturnType<typeof client.signAndExecuteTransaction>>) {
  const changes = result.objectChanges ?? [];
  let walletId = '';
  let capId = '';
  for (const c of changes) {
    if (c.type !== 'created') continue;
    if (c.objectType.includes('::agent_wallet::AgentWallet')) walletId = c.objectId;
    if (c.objectType.includes('::agent_wallet::AgentCap')) capId = c.objectId;
  }
  return { walletId, capId };
}

async function createWallet(budgetMist: number, perTxMist: number, expiresAtMs: number) {
  const tx = new Transaction();
  const [funds] = tx.splitCoins(tx.gas, [budgetMist]);
  tx.moveCall({
    target: `${PKG}::agent_wallet::create_wallet`,
    typeArguments: [SUI],
    arguments: [
      funds,
      tx.pure.address(ME), // agent = me (single-key test)
      tx.pure.u64(perTxMist),
      tx.pure.u64(expiresAtMs),
      tx.pure.vector('address', []),
    ],
  });
  const r = await run(tx, `create_wallet (budget=${budgetMist}, perTx=${perTxMist})`);
  if (!r.ok) throw new Error(`create_wallet failed: ${r.err}`);
  return createdIds(r.result);
}

function spendTx(walletId: string, capId: string, amount: number): Transaction {
  const tx = new Transaction();
  const coin = tx.moveCall({
    target: `${PKG}::agent_wallet::spend`,
    typeArguments: [SUI],
    arguments: [tx.object(walletId), tx.object(capId), tx.pure.u64(amount), tx.object(CLOCK)],
  });
  tx.mergeCoins(tx.gas, [coin]); // consume the released coin (it's SUI)
  return tx;
}

async function main() {
  console.log(`agent_wallet live battle-test — ${NETWORK}`);
  console.log(`  signer: ${ME}`);
  console.log(`  package: ${PKG}\n`);
  const now = Date.now();

  // 1) create wallet A: budget 0.05, per-tx 0.02, expiry far future
  console.log('1) create_wallet A');
  const A = await createWallet(50_000_000, 20_000_000, now + 3_600_000);
  check(!!A.walletId && !!A.capId, 'wallet + cap created', `${A.walletId.slice(0, 10)}… cap ${A.capId.slice(0, 10)}…`);

  // 2) spend within caps (0.01 <= per-tx 0.02, <= budget) → success
  console.log('2) spend within caps (0.01 SUI)');
  const s1 = await run(spendTx(A.walletId, A.capId, 10_000_000), 'spend 0.01');
  check(s1.ok, 'spend within caps succeeded');

  // 3) spend over per-tx (0.03 > per-tx 0.02) → abort E_OVER_PER_TX (4)
  console.log('3) spend over per-tx (0.03 SUI)');
  const s2 = await run(spendTx(A.walletId, A.capId, 30_000_000), 'spend 0.03');
  check(!s2.ok && abortCode(s2.err) === 4, 'over-per-tx aborted with code 4', `(got ${abortCode(s2.err)})`);

  // 4) bad cap: create wallet B, use B's cap on wallet A → abort E_BAD_CAP (6)
  console.log('4) bad cap (wallet B cap on wallet A)');
  const B = await createWallet(10_000_000, 10_000_000, now + 3_600_000);
  const s3 = await run(spendTx(A.walletId, B.capId, 1_000_000), 'spend A with B.cap');
  check(!s3.ok && abortCode(s3.err) === 6, 'bad-cap aborted with code 6', `(got ${abortCode(s3.err)})`);

  // 5) revoke wallet A (owner reclaims remaining) → success
  console.log('5) revoke wallet A');
  const revTx = new Transaction();
  const reclaimed = revTx.moveCall({
    target: `${PKG}::agent_wallet::revoke`,
    typeArguments: [SUI],
    arguments: [revTx.object(A.walletId)],
  });
  revTx.transferObjects([reclaimed], ME);
  const rev = await run(revTx, 'revoke A');
  check(rev.ok, 'revoke succeeded (owner reclaimed funds)');

  // 6) spend after revoke → abort E_REVOKED (2)
  console.log('6) spend after revoke');
  const s4 = await run(spendTx(A.walletId, A.capId, 1_000_000), 'spend revoked A');
  check(!s4.ok && abortCode(s4.err) === 2, 'spend-after-revoke aborted with code 2', `(got ${abortCode(s4.err)})`);

  // 7) expiry: create wallet C expiring in ~8s, wait, spend → abort E_EXPIRED (3)
  console.log('7) expiry (wallet C, expires in ~8s)');
  const C = await createWallet(10_000_000, 10_000_000, Date.now() + 8_000);
  console.log('   waiting ~12s for expiry…');
  await new Promise((r) => setTimeout(r, 12_000));
  const s5 = await run(spendTx(C.walletId, C.capId, 1_000_000), 'spend expired C');
  check(!s5.ok && abortCode(s5.err) === 3, 'expiry aborted with code 3', `(got ${abortCode(s5.err)})`);

  // cleanup: reclaim B and C
  console.log('cleanup) revoke B + C to reclaim funds');
  for (const [name, w] of [['B', B], ['C', C]] as const) {
    const tx = new Transaction();
    const coin = tx.moveCall({ target: `${PKG}::agent_wallet::revoke`, typeArguments: [SUI], arguments: [tx.object(w.walletId)] });
    tx.transferObjects([coin], ME);
    await run(tx, `revoke ${name}`);
  }

  console.log(`\n──────── RESULT: ${passed} passed, ${failed} failed ────────`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
