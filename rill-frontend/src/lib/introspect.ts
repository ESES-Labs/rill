// Introspection: real Sui RPC via Rill backend for package IDs; protocol picker uses curated profiles.

import { PROTOCOLS, type Protocol } from "./protocols";
import { rillApi, type BackendFunction } from "./rill-api";

export type Port = {
  key: string;
  label: string;
  type: "address" | "u64" | "u128" | "Coin" | "vector<u8>" | "bool" | "ID" | "string" | "event";
  /** semantic role used by the agent + guardrails */
  role?: "amount_in" | "amount_out" | "token_in" | "token_out" | "recipient" | "min_out" | "deadline" | "event" | "id";
};

export type DiscoveredFunction = {
  id: string;
  module: string;
  name: string;
  /** human description inferred from the ABI / docstring */
  description: string;
  inputs: Port[];
  outputs: Port[];
  /** matched event types emitted by this function */
  events: string[];
  /** suggested node color */
  color: "mint" | "peach" | "sky" | "lilac";
};

export type IntrospectionResult = {
  source: { kind: "package" | "tx" | "protocol"; value: string };
  protocol: string;
  packageId: string;
  functions: DiscoveredFunction[];
  /** estimated confidence 0..1 */
  confidence: number;
};

const SAMPLE_PACKAGES: Record<string, string> = {
  cetus: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
  navi: "0x06ae35ce4d3c9c0ccd0d3bce5d3a8c4f33ad58e88a7e9c4fc6e9a1ec0d2c7d11",
  scallop: "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fcfc",
  haedal: "0x0a6ff2b974e08b65649d334c38db5ca046b78b4a5d892087740b9cdb3eb08e47",
  bluemove: "0x9d3f4cd9a5e3b3a6d2c7f5f1e4b8a9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2",
  pyth: "0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e",
  suins: "0xb7004c7914308557f7afbaf0dca8dd258e18e306cb7a45b28019f3d0a693f162",
  wormhole: "0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a",
};

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SAMPLE_PACKAGES).map(([k, v]) => [v.toLowerCase(), k]),
);

const PROFILES: Record<string, Omit<DiscoveredFunction, "id">[]> = {
  cetus: [
    {
      module: "pool",
      name: "swap_a_to_b",
      description: "Swap exact-in along a Cetus CLMM pool, returns coin_out and fee.",
      color: "mint",
      inputs: [
        { key: "pool", label: "pool", type: "ID", role: "id" },
        { key: "coin_in", label: "coin_in", type: "Coin", role: "token_in" },
        { key: "amount_in", label: "amount_in", type: "u64", role: "amount_in" },
        { key: "min_amount_out", label: "min_amount_out", type: "u64", role: "min_out" },
      ],
      outputs: [
        { key: "amount_out", label: "amount_out", type: "u64", role: "amount_out" },
        { key: "coin_out", label: "coin_out", type: "Coin", role: "token_out" },
        { key: "SwapEvent", label: "SwapEvent", type: "event", role: "event" },
      ],
      events: ["cetus::pool::SwapEvent"],
    },
    {
      module: "pool",
      name: "add_liquidity",
      description: "Add concentrated liquidity in a tick range.",
      color: "mint",
      inputs: [
        { key: "pool", label: "pool", type: "ID", role: "id" },
        { key: "amount_a", label: "amount_a", type: "u64" },
        { key: "amount_b", label: "amount_b", type: "u64" },
      ],
      outputs: [
        { key: "position", label: "position", type: "ID", role: "id" },
        { key: "AddLiquidityEvent", label: "AddLiquidityEvent", type: "event", role: "event" },
      ],
      events: ["cetus::pool::AddLiquidityEvent"],
    },
  ],
  navi: [
    {
      module: "lending",
      name: "supply",
      description: "Supply coin as collateral, mints a receipt.",
      color: "sky",
      inputs: [
        { key: "asset", label: "asset", type: "Coin", role: "token_in" },
        { key: "amount_in", label: "amount_in", type: "u64", role: "amount_in" },
      ],
      outputs: [
        { key: "receipt", label: "receipt", type: "ID", role: "id" },
        { key: "SupplyEvent", label: "SupplyEvent", type: "event", role: "event" },
      ],
      events: ["navi::lending::SupplyEvent"],
    },
    {
      module: "lending",
      name: "borrow",
      description: "Borrow asset against deposited collateral.",
      color: "sky",
      inputs: [
        { key: "asset", label: "asset", type: "address", role: "token_out" },
        { key: "amount", label: "amount", type: "u64", role: "amount_in" },
      ],
      outputs: [
        { key: "amount_out", label: "amount_out", type: "Coin", role: "amount_out" },
        { key: "BorrowEvent", label: "BorrowEvent", type: "event", role: "event" },
      ],
      events: ["navi::lending::BorrowEvent"],
    },
  ],
  scallop: [
    {
      module: "market",
      name: "deposit",
      description: "Deposit asset, mints sCoin shares.",
      color: "peach",
      inputs: [
        { key: "coin_in", label: "coin_in", type: "Coin", role: "token_in" },
        { key: "amount_in", label: "amount_in", type: "u64", role: "amount_in" },
      ],
      outputs: [
        { key: "scoin", label: "scoin", type: "Coin", role: "token_out" },
        { key: "amount_out", label: "amount_out", type: "u64", role: "amount_out" },
      ],
      events: ["scallop::market::DepositEvent"],
    },
  ],
  haedal: [
    {
      module: "staking",
      name: "stake",
      description: "Stake SUI, mints haSUI.",
      color: "lilac",
      inputs: [
        { key: "sui_in", label: "sui_in", type: "Coin", role: "token_in" },
        { key: "amount_in", label: "amount_in", type: "u64", role: "amount_in" },
      ],
      outputs: [
        { key: "hasui_out", label: "hasui_out", type: "Coin", role: "token_out" },
        { key: "amount_out", label: "amount_out", type: "u64", role: "amount_out" },
        { key: "StakeEvent", label: "StakeEvent", type: "event", role: "event" },
      ],
      events: ["haedal::staking::StakeEvent"],
    },
  ],
  pyth: [
    {
      module: "price",
      name: "update_price_feed",
      description: "Refresh and read a Pyth price feed.",
      color: "sky",
      inputs: [
        { key: "feed_id", label: "feed_id", type: "vector<u8>", role: "id" },
        { key: "vaa", label: "vaa", type: "vector<u8>" },
      ],
      outputs: [
        { key: "price", label: "price", type: "u128" },
        { key: "conf", label: "conf", type: "u64" },
        { key: "ts", label: "ts", type: "u64" },
      ],
      events: ["pyth::price::PriceUpdated"],
    },
  ],
  suins: [
    {
      module: "registry",
      name: "resolve",
      description: "Resolve a .sui name to an address.",
      color: "mint",
      inputs: [{ key: "name", label: "name", type: "string" }],
      outputs: [{ key: "addr", label: "addr", type: "address", role: "recipient" }],
      events: [],
    },
  ],
  bluemove: [
    {
      module: "market",
      name: "buy",
      description: "Buy a listed NFT.",
      color: "peach",
      inputs: [
        { key: "listing", label: "listing", type: "ID", role: "id" },
        { key: "payment", label: "payment", type: "Coin", role: "amount_in" },
      ],
      outputs: [
        { key: "nft", label: "nft", type: "ID", role: "id" },
        { key: "BuyEvent", label: "BuyEvent", type: "event", role: "event" },
      ],
      events: ["bluemove::market::BuyEvent"],
    },
  ],
  wormhole: [
    {
      module: "bridge",
      name: "transfer_tokens",
      description: "Bridge tokens out of Sui via Wormhole.",
      color: "lilac",
      inputs: [
        { key: "coin_in", label: "coin_in", type: "Coin", role: "token_in" },
        { key: "amount_in", label: "amount_in", type: "u64", role: "amount_in" },
        { key: "recipient_chain", label: "recipient_chain", type: "u64" },
        { key: "recipient", label: "recipient", type: "vector<u8>", role: "recipient" },
      ],
      outputs: [
        { key: "sequence", label: "sequence", type: "u64", role: "id" },
        { key: "TransferEvent", label: "TransferEvent", type: "event", role: "event" },
      ],
      events: ["wormhole::bridge::TransferEvent"],
    },
  ],
};

function build(protocolId: string): DiscoveredFunction[] {
  const fns = PROFILES[protocolId] ?? [];
  return fns.map((f, i) => ({ ...f, id: `${protocolId}_${f.module}_${f.name}_${i}` }));
}

function detectProtocolFromTx(digest: string): string {
  // toy hash → protocol selection so demo feels deterministic
  let h = 0;
  for (let i = 0; i < digest.length; i++) h = (h * 31 + digest.charCodeAt(i)) >>> 0;
  const ids = Object.keys(PROFILES);
  return ids[h % ids.length];
}

function mapBackendFunction(fn: BackendFunction, packageId: string, idx: number): DiscoveredFunction {
  const protocolGuess = packageId.includes("0a6ff") ? "haedal" : "cetus";
  const color = protocolGuess === "haedal" ? "lilac" : "mint";

  const inputs: Port[] = fn.parameters.map((p, i) => ({
    key: p.name ?? `arg_${i}`,
    label: p.name ?? `arg_${i}`,
    type: p.class === "coin" ? "Coin" : p.moveType.includes("u64") ? "u64" : "string",
    role:
      p.class === "coin"
        ? "token_in"
        : p.moveType.includes("u64")
          ? "amount_in"
          : p.class === "object"
            ? "id"
            : undefined,
  }));

  return {
    id: `${fn.module}_${fn.name}_${idx}`,
    module: fn.module,
    name: fn.name,
    description: `${fn.module}::${fn.name} — introspected from chain (${fn.parameters.length} params)`,
    color,
    inputs,
    outputs: [],
    events: [],
  };
}

async function introspectPackage(packageId: string): Promise<IntrospectionResult> {
  const fns = await rillApi.introspect(packageId);
  const protocolId = REVERSE[packageId.toLowerCase()] ?? "unknown";
  const proto = PROTOCOLS.find((p) => p.id === protocolId);

  return {
    source: { kind: "package", value: packageId },
    protocol: proto?.name ?? "On-chain package",
    packageId,
    functions: fns.map((fn, idx) => mapBackendFunction(fn, packageId, idx)),
    confidence: 0.95,
  };
}

export async function introspect(opts: {
  kind: "package" | "tx" | "protocol";
  value: string;
}): Promise<IntrospectionResult> {
  const v = opts.value.trim();

  if (opts.kind === "package") {
    try {
      return await introspectPackage(v);
    } catch (err) {
      console.warn("Rill introspect failed, falling back to curated profile:", err);
      const protocolId = REVERSE[v.toLowerCase()] ?? "cetus";
      const proto = PROTOCOLS.find((p) => p.id === protocolId);
      return {
        source: { kind: "package", value: v },
        protocol: proto?.name ?? protocolId,
        packageId: v,
        functions: build(protocolId),
        confidence: 0.5,
      };
    }
  }

  // Protocol picker + tx hash demo — curated profiles (not yet wired to backend compile)
  await new Promise((r) => setTimeout(r, 400));
  let protocolId = "cetus";
  let packageId = SAMPLE_PACKAGES.cetus;

  if (opts.kind === "protocol") {
    protocolId = v;
    packageId = SAMPLE_PACKAGES[v] ?? "0x" + v.padEnd(64, "0");
  } else {
    protocolId = detectProtocolFromTx(v);
    packageId = SAMPLE_PACKAGES[protocolId];
  }

  const proto: Protocol | undefined = PROTOCOLS.find((p) => p.id === protocolId);
  return {
    source: { kind: opts.kind, value: v },
    protocol: proto?.name ?? protocolId,
    packageId,
    functions: build(protocolId),
    confidence: 0.86 + (protocolId.length % 5) * 0.02,
  };
}

export const KNOWN_PROTOCOL_IDS = Object.keys(SAMPLE_PACKAGES);
export const SAMPLE_PACKAGE_IDS = SAMPLE_PACKAGES;
