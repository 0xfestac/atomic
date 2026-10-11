import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_CHAINS,
  CHAIN_LIST,
  chainByEvmId,
  chainName,
  chainOrNull,
  explorerAddress,
  explorerTx,
  isChainId,
  resolveChains,
  rpcEnvVar,
} from "@/lib/atomic/chains";
import { buildTypedData } from "@/lib/atomic/intents/builder";
import { rpcCall } from "@/lib/atomic/onchain/rpc";
import type { Chain } from "@/lib/atomic/types";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

const ZKSYNC = {
  id: "zksync-era",
  name: "zkSync Era",
  evmChainId: 324,
  nativeSymbol: "ETH",
  rpc: ["https://mainnet.era.zksync.io"],
  explorer: "https://explorer.zksync.io",
};

function spec(chain: string) {
  return {
    kind: "swap" as const,
    chain,
    from: "0xa70f1c00000000000000000000000000000a70f1",
    to: "0xe592427a0aece92de3edee1f18e0157c05861564",
    amount: 100,
  };
}

describe("built-in registry", () => {
  it("carries canonical EIP-155 ids", () => {
    expect(chainByEvmId(1)?.id).toBe("ethereum");
    expect(chainByEvmId(8453)?.id).toBe("base");
    expect(chainByEvmId(42161)?.id).toBe("arbitrum");
    expect(chainByEvmId(10)?.id).toBe("optimism");
    expect(chainByEvmId(137)?.id).toBe("polygon");
    expect(chainByEvmId(56)?.id).toBe("bnb");
    expect(chainByEvmId(43114)?.id).toBe("avalanche");
  });

  it("ships failover endpoints for every live chain", () => {
    for (const c of BUILTIN_CHAINS) {
      expect(c.live).toBe(true);
      expect(c.rpc.length).toBeGreaterThanOrEqual(2);
      for (const e of c.rpc) expect(e.startsWith("https://")).toBe(true);
    }
  });

  it("defaults run exactly the built-in registry", () => {
    expect(CHAIN_LIST.length).toBe(BUILTIN_CHAINS.length);
    expect(isChainId("ethereum")).toBe(true);
    expect(isChainId("not-a-chain")).toBe(false);
    expect(chainOrNull("not-a-chain")).toBeUndefined();
    expect(chainName("not-a-chain")).toBe("not-a-chain");
  });
});

describe("resolveChains — operator configuration", () => {
  it("adds an operator-defined chain with derived defaults", () => {
    const { chains, warnings } = resolveChains({ custom: [ZKSYNC] });
    expect(warnings).toEqual([]);
    const zk = chains.find((c) => c.id === "zksync-era");
    expect(zk).toBeDefined();
    expect(zk!.evmChainId).toBe(324);
    expect(zk!.source).toBe("config");
    expect(zk!.short).toBe("ZKSYNC");
    expect(zk!.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(zk!.live).toBe(true);
    expect(zk!.rpcOverridden).toBe(false);
    expect(chains.find((c) => c.evmChainId === 324)?.id).toBe("zksync-era");
  });

  it("patches a built-in by id without mutating the built-in", () => {
    const { chains } = resolveChains({ custom: [{ id: "base", explorer: "https://explorer.example.com" }] });
    const base = chains.find((c) => c.id === "base");
    expect(base?.explorer).toBe("https://explorer.example.com");
    expect(base?.source).toBe("builtin");
    expect(BUILTIN_CHAINS.find((c) => c.id === "base")?.explorer).toBe("https://basescan.org");
    expect(base?.evmChainId).toBe(8453);
  });

  it("requires full definitions for new chains", () => {
    const { chains, warnings } = resolveChains({
      custom: [
        { id: "no-name", evmChainId: 999, nativeSymbol: "X", rpc: ["https://rpc.example.com"] },
        { id: "no-evm", name: "No EVM", nativeSymbol: "X", rpc: ["https://rpc.example.com"] },
        { id: "no-rpc", name: "No RPC", evmChainId: 998, nativeSymbol: "X" },
        { id: "Bad Id!", name: "Bad", evmChainId: 997, nativeSymbol: "X", rpc: ["https://rpc.example.com"] },
        "not-an-object",
      ],
    });
    expect(chains.filter((c) => c.source === "config")).toHaveLength(0);
    expect(warnings).toHaveLength(5);
  });

  it("rejects unusable endpoint lists", () => {
    for (const rpc of [["ftp://rpc.example.com"], ["not a url"], ["", "  "]]) {
      const { warnings } = resolveChains({ custom: [{ ...ZKSYNC, rpc }] });
      expect(warnings.join(" ")).toMatch(/missing rpc/);
    }
  });

  it("dedupes and caps the endpoint list", () => {
    const { chains } = resolveChains({
      custom: [{ ...ZKSYNC, rpc: ["https://a.example.com", "https://a.example.com", "https://b.example.com"] }],
    });
    expect(chains.find((c) => c.id === "zksync-era")?.rpc).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("drops entries whose evmChainId collides with another chain", () => {
    const { chains, warnings } = resolveChains({
      custom: [ZKSYNC, { ...ZKSYNC, id: "impostor", evmChainId: 137 }],
    });
    expect(chains.some((c) => c.id === "impostor")).toBe(false);
    expect(chains.some((c) => c.id === "zksync-era")).toBe(true);
    expect(warnings.join(" ")).toMatch(/already used by "polygon"/);
  });

  it("removes disabled chains and warns on unknown ids", () => {
    const { chains, warnings } = resolveChains({ disabled: ["avalanche", "ghost-chain", "  "] });
    expect(chains.some((c) => c.id === "avalanche")).toBe(false);
    expect(warnings).toEqual(['ATOMIC_CHAINS_DISABLED: "ghost-chain" is not a configured chain']);
  });

  it("applies rpc overrides and flags them", () => {
    const { chains, warnings } = resolveChains({
      rpcOverrides: { base: ["https://private-base.example.com"], ghost: ["https://x.example.com"] },
    });
    const base = chains.find((c) => c.id === "base");
    expect(base?.rpc).toEqual(["https://private-base.example.com"]);
    expect(base?.rpcOverridden).toBe(true);
    expect(warnings).toEqual(['rpc override for unknown chain "ghost" — ignored']);
  });

  it("recovers from invalid JSON config with a warning", () => {
    const { chains, warnings } = resolveChains({ customJson: "{not json" });
    expect(chains.map((c) => c.id)).toEqual(BUILTIN_CHAINS.map((c) => c.id));
    expect(warnings).toEqual(["ATOMIC_CHAINS: not valid JSON — ignored"]);
  });

  it("honors live:false (demo-only chains)", () => {
    const { chains } = resolveChains({ custom: [{ ...ZKSYNC, live: false }] });
    expect(chains.find((c) => c.id === "zksync-era")?.live).toBe(false);
  });
});

describe("typed-data chain binding", () => {
  it("uses real EIP-155 ids from the registry", () => {
    const domainOf = (chain: string, registry?: Chain[]) =>
      (buildTypedData(spec(chain), registry).domain as { chainId: number }).chainId;
    expect(domainOf("ethereum")).toBe(1);
    expect(domainOf("polygon")).toBe(137);
    expect(domainOf("base")).toBe(8453);
    // Unknown chains get 0 instead of a plausible guess.
    expect(domainOf("not-a-chain")).toBe(0);
  });

  it("binds operator-added chains through a passed registry", () => {
    const { chains } = resolveChains({ custom: [ZKSYNC] });
    const domain = buildTypedData(spec("zksync-era"), chains).domain as { chainId: number };
    expect(domain.chainId).toBe(324);
  });
});

describe("rpc client chain guards", () => {
  it("rejects unconfigured chains without any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(rpcCall<string>("not-a-chain", "eth_blockNumber")).rejects.toThrow(/unknown chain/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("explorer helpers", () => {
  it("builds explorer links", () => {
    expect(explorerAddress("ethereum", VITALIK)).toBe(`https://etherscan.io/address/${VITALIK}`);
    expect(explorerTx("ethereum", "0xdeadbeef")).toBe("https://etherscan.io/tx/0xdeadbeef");
    expect(explorerAddress("not-a-chain", VITALIK)).toBeNull();
    expect(explorerTx("not-a-chain", "0xdeadbeef")).toBeNull();
  });
});

describe("env var naming", () => {
  it("maps registry ids to env-safe names", () => {
    expect(rpcEnvVar("ethereum")).toBe("ATOMIC_RPC_ETHEREUM");
    expect(rpcEnvVar("zksync-era")).toBe("ATOMIC_RPC_ZKSYNC_ERA");
  });
});
