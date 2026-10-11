import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconfigureChains, CHAINS } from "@/lib/atomic/chains";
import {
  chainTokens,
  decodeSymbolData,
  liveTokenBalances,
  liveTransfers,
  resetErc20Caches,
} from "@/lib/atomic/onchain/erc20";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const BINANCE = "0x28c6c06298d514db089934071355e5743bf21d60";
const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH_ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const LINK_ETH = "0x514910771af9ca656af840dff83e8264ecf986ca";
const UNKNOWN_TOKEN = "0x6b175474e89094c44da98b954eedeac495271d0f";

const BALANCE_OF = "0x70a08231";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function rpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
}

interface Req {
  method: string;
  params: unknown[];
  data?: string;
  to?: string;
  topics?: unknown[];
  block?: string;
}

function parseReq(init: { body: string }): Req {
  const raw = JSON.parse(init.body) as { method: string; params: unknown[] };
  const first = raw.params?.[0] as { data?: string; to?: string; topics?: unknown[] } | undefined;
  return {
    method: raw.method,
    params: raw.params,
    data: first?.data,
    to: first?.to,
    topics: first?.topics,
    block: typeof raw.params?.[0] === "string" ? (raw.params[0] as string) : undefined,
  };
}

beforeEach(() => {
  resetErc20Caches();
  delete process.env.ATOMIC_DISABLE_LIVE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chainTokens", () => {
  it("ships a curated major-token list for the built-in chains", () => {
    const eth = chainTokens("ethereum");
    expect(eth.length).toBeGreaterThanOrEqual(5);
    expect(eth.find((t) => t.symbol === "USDC")?.address).toBe(USDC_ETH);
    for (const t of eth) expect(t.address).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("returns nothing for chains without curated or configured tokens", () => {
    expect(chainTokens("not-a-chain")).toEqual([]);
  });

  it("prefers operator-configured tokens over the curated list", () => {
    try {
      reconfigureChains({
        custom: [{ id: "ethereum", tokens: [{ address: UNKNOWN_TOKEN, symbol: "OPR", decimals: 18 }] }],
      });
      expect(CHAINS["ethereum"].tokens).toHaveLength(1);
      expect(chainTokens("ethereum").map((t) => t.symbol)).toEqual(["OPR"]);
    } finally {
      reconfigureChains({});
    }
    expect(CHAINS["ethereum"].tokens).toBeUndefined();
    expect(chainTokens("ethereum").length).toBeGreaterThanOrEqual(5);
  });
});

describe("decodeSymbolData", () => {
  it("decodes a dynamic string return", () => {
    const data =
      "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000";
    expect(decodeSymbolData(data)).toBe("USDC");
  });

  it("decodes a bytes32 return (MKR style)", () => {
    const mkr = "0x" + Buffer.from("MKR", "utf8").toString("hex").padEnd(64, "0");
    expect(decodeSymbolData(mkr)).toBe("MKR");
  });

  it("rejects empty or malformed payloads", () => {
    expect(decodeSymbolData("0x" + "00".repeat(32))).toBeNull();
    expect(decodeSymbolData("0x1234")).toBeNull();
  });
});

describe("liveTokenBalances", () => {
  it("reads balances for curated tokens and skips zero or failed reads", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const req = parseReq(init);
      if (req.method === "eth_call" && req.data?.startsWith(BALANCE_OF)) {
        const token = "0x" + req.data.slice(-40);
        if (token === USDC_ETH) return rpcResponse("0x" + (3_000_000n * 10n ** 6n).toString(16)); // 3,000,000 USDC
        if (token === WETH_ETH) return rpcResponse("0x1bc16d674ec80000"); // 2 (18 dec)
        if (token === LINK_ETH) return rpcResponse("0x0"); // zero → skipped
        return rpcResponse("0x0");
      }
      return rpcResponse("0x0");
    });
    vi.stubGlobal("fetch", fetchMock);

    const positions = await liveTokenBalances("ethereum", VITALIK);
    expect(positions).not.toBeNull();
    expect(positions).toHaveLength(2);
    // largest first
    expect(positions![0].symbol).toBe("USDC");
    expect(positions![0].amount).toBe(3_000_000);
    expect(positions![0].amountRaw).toBe((3_000_000n * 10n ** 6n).toString());
    expect(positions![1].symbol).toBe("WETH");
    expect(positions![1].amount).toBe(2);
    expect(positions![1].token).toBe(WETH_ETH);
    // one call per curated token (symbols/decimals come from the curated list)
    expect(fetchMock).toHaveBeenCalledTimes(chainTokens("ethereum").length);
  });

  it("is null when the chain has no token list, without network calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTokenBalances("not-a-chain", VITALIK)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is null when live reads are disabled", async () => {
    process.env.ATOMIC_DISABLE_LIVE = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTokenBalances("ethereum", VITALIK)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is null when every balance read fails", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "rate limited" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTokenBalances("ethereum", VITALIK)).toBeNull();
  });

  it("rejects malformed addresses without network calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTokenBalances("ethereum", "0x1234")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("liveTransfers", () => {
  function transferLog(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      address: USDC_ETH,
      topics: [TRANSFER_TOPIC, "0x" + "0".repeat(24) + VITALIK.slice(2), "0x" + "0".repeat(24) + BINANCE.slice(2)],
      data: "0xf4240", // 1,000,000
      blockNumber: "0x270e",
      transactionHash: "0x" + "a1".repeat(32),
      logIndex: "0x0",
      ...overrides,
    };
  }

  function mockChainRpc(logsFrom: unknown[], logsTo: unknown[]) {
    return vi.fn(async (_url: unknown, init: { body: string }) => {
      const req = parseReq(init);
      if (req.method === "eth_blockNumber") return rpcResponse("0x2710"); // 10000
      if (req.method === "eth_getLogs") {
        const fromScan = Array.isArray(req.topics?.[1]);
        return rpcResponse(fromScan ? logsFrom : logsTo);
      }
      if (req.method === "eth_getBlockByNumber") {
        if (req.block === "0x270e") return rpcResponse({ timestamp: "0x68dd5a80" });
        if (req.block === "0x270f") return rpcResponse({ timestamp: "0x68dd5a81" });
      }
      if (req.method === "eth_call" && req.data?.startsWith("0x95d89b41")) {
        // symbol() for the unknown token, bytes32-encoded "DAI"
        return rpcResponse("0x" + Buffer.from("DAI", "utf8").toString("hex").padEnd(64, "0"));
      }
      if (req.method === "eth_call" && req.data?.startsWith("0x313ce567")) return rpcResponse("0x12"); // 18
      return rpcResponse("0x0");
    });
  }

  it("merges both scan directions, dedupes, and annotates timestamps", async () => {
    const fetchMock = mockChainRpc(
      [
        transferLog({}), // out: vitalik → binance
        transferLog({
          transactionHash: "0x" + "c3".repeat(32),
          topics: [TRANSFER_TOPIC, "0x" + "0".repeat(24) + VITALIK.slice(2), "0x" + "0".repeat(24) + VITALIK.slice(2)],
          blockNumber: "0x270f",
        }), // self-transfer → appears in both scans
        { ...transferLog({ data: "0x" }), data: "0x" }, // ERC-721 shape → skipped
      ],
      [
        transferLog({
          transactionHash: "0x" + "b2".repeat(32),
          logIndex: "0x1",
          blockNumber: "0x270f",
          address: WETH_ETH,
          topics: [TRANSFER_TOPIC, "0x" + "0".repeat(24) + BINANCE.slice(2), "0x" + "0".repeat(24) + VITALIK.slice(2)],
          data: "0xde0b6b3a7640000", // 1 WETH
        }),
        transferLog({
          transactionHash: "0x" + "c3".repeat(32),
          topics: [TRANSFER_TOPIC, "0x" + "0".repeat(24) + VITALIK.slice(2), "0x" + "0".repeat(24) + VITALIK.slice(2)],
          blockNumber: "0x270f",
        }), // duplicate of the self-transfer
      ],
    );
    vi.stubGlobal("fetch", fetchMock);

    const transfers = await liveTransfers("ethereum", VITALIK);
    expect(transfers).not.toBeNull();
    expect(transfers).toHaveLength(3);
    // newest block first; same block ties break by hash (self-transfer 0xc3… before 0xb2…)
    expect(transfers![0].direction).toBe("out"); // self-transfer deduped to "out"
    expect(transfers![0].token).toBe(USDC_ETH);
    expect(transfers![0].counterparty).toBe(VITALIK);
    expect(transfers![1].direction).toBe("in"); // WETH in at 0x270f
    expect(transfers![1].symbol).toBe("WETH");
    expect(transfers![1].counterparty).toBe(BINANCE);
    expect(transfers![1].amount).toBe(1);
    expect(transfers![2].direction).toBe("out"); // USDC out at 0x270e
    expect(transfers![2].timestamp).not.toBeNull();
    expect(transfers![2].amount).toBe(1); // 1e6 raw at 6 decimals
  });

  it("resolves symbol and decimals live for tokens outside the curated list", async () => {
    const fetchMock = mockChainRpc(
      [
        transferLog({
          address: UNKNOWN_TOKEN,
          transactionHash: "0x" + "d4".repeat(32),
          data: "0xde0b6b3a7640000", // 1 unit at 18 decimals
        }),
      ],
      [],
    );
    vi.stubGlobal("fetch", fetchMock);
    const transfers = await liveTransfers("ethereum", VITALIK);
    expect(transfers).toHaveLength(1);
    expect(transfers![0].symbol).toBe("DAI");
    expect(transfers![0].amount).toBe(1);
  });

  it("returns [] when the window has no transfers but the RPC works", async () => {
    vi.stubGlobal("fetch", mockChainRpc([], []));
    expect(await liveTransfers("ethereum", VITALIK)).toEqual([]);
  });

  it("shrinks the getLogs window when the RPC rejects large ranges", async () => {
    const rangesSeen: string[] = [];
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const raw = JSON.parse(init.body) as { method: string; params: [{ fromBlock: string; topics: unknown[] }] };
      if (raw.method === "eth_blockNumber") return rpcResponse("0x2710");
      if (raw.method === "eth_getLogs") {
        const key = raw.params[0].fromBlock;
        if (!rangesSeen.includes(key)) rangesSeen.push(key);
        // Reject the two largest windows (smaller fromBlock = wider range),
        // accept from 256 blocks back.
        if (BigInt(key) < 10_000n - 256n) {
          return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32005, message: "range too large" } }), { status: 200 });
        }
        const fromScan = Array.isArray(raw.params[0].topics?.[1]);
        return rpcResponse(fromScan ? [transferLog({})] : []);
      }
      if (raw.method === "eth_getBlockByNumber") return rpcResponse({ timestamp: "0x68dd5a80" });
      return rpcResponse("0x0");
    });
    vi.stubGlobal("fetch", fetchMock);
    const transfers = await liveTransfers("ethereum", VITALIK);
    expect(transfers).toHaveLength(1);
    expect(transfers![0].direction).toBe("out");
    // The largest windows were attempted first, then the accepted one.
    expect(rangesSeen.length).toBe(3);
    expect(BigInt(rangesSeen[0])).toBeLessThan(BigInt(rangesSeen[1]));
  });

  it("is null when getLogs is unsupported on the chain", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const req = parseReq(init);
      if (req.method === "eth_blockNumber") return rpcResponse("0x2710");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "method not found" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTransfers("ethereum", VITALIK)).toBeNull();
  });

  it("falls back to address-pinned per-token scans when topics-only getLogs is rejected", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const raw = JSON.parse(init.body) as { method: string; params: [{ fromBlock: string; topics?: unknown[]; address?: string }] };
      if (raw.method === "eth_blockNumber") return rpcResponse("0x2710");
      if (raw.method === "eth_getLogs") {
        // RPC policy: requests without a token address are rejected.
        if (!raw.params[0].address) {
          return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32701, message: "specify an address" } }), { status: 200 });
        }
        const fromScan = Array.isArray(raw.params[0].topics?.[1]);
        return rpcResponse(
          fromScan
            ? [transferLog({ transactionHash: "0x" + "e5".repeat(32) })]
            : [],
        );
      }
      if (raw.method === "eth_getBlockByNumber") return rpcResponse({ timestamp: "0x68dd5a80" });
      return rpcResponse("0x0");
    });
    vi.stubGlobal("fetch", fetchMock);
    const transfers = await liveTransfers("ethereum", VITALIK);
    expect(transfers).toHaveLength(1);
    expect(transfers![0].direction).toBe("out");
    expect(transfers![0].token).toBe(USDC_ETH);
    // The pinned fallback scans carried an explicit address filter.
    const getLogsBodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body)).filter((b) => b.method === "eth_getLogs");
    expect(getLogsBodies.length).toBeGreaterThan(0);
    expect(getLogsBodies.some((b) => typeof b.params[0].address === "string")).toBe(true);
  });

  it("is null when live reads are disabled or the address is malformed", async () => {
    process.env.ATOMIC_DISABLE_LIVE = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await liveTransfers("ethereum", VITALIK)).toBeNull();
    expect(await liveTransfers("ethereum", "nope")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
