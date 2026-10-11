import { describe, expect, it, afterAll, afterEach, beforeEach, vi } from "vitest";
import { keccak256Hex, ensNamehash, toChecksumAddress } from "@/lib/atomic/onchain/keccak";
import {
  decodeEvmString,
  hexToBigInt,
  scanBytecode,
  BYTECODE_SELECTORS,
  formatWei,
  resolveEns,
  onchainFacts,
} from "@/lib/atomic/onchain/adapter";
import { rpcCall, RpcError } from "@/lib/atomic/onchain/rpc";
import { isValidWebhookUrl } from "@/lib/atomic/alerts/rules";
import { rateLimit } from "@/lib/atomic/api/guard";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

describe("keccak256", () => {
  it("matches canonical test vectors", () => {
    expect(keccak256Hex("")).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(keccak256Hex("abc")).toBe("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
    expect(keccak256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15",
    );
  });

  it("hashes byte arrays identically to strings", () => {
    expect(keccak256Hex(new TextEncoder().encode("abc"))).toBe(keccak256Hex("abc"));
  });
});

describe("ENS namehash (EIP-137)", () => {
  it("root hashes to zero", () => {
    expect(ensNamehash("")).toBe("0".repeat(64));
  });

  it("hashes 'eth' to the canonical ENS node", () => {
    expect(ensNamehash("eth")).toBe("93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae");
  });

  it("is case-insensitive", () => {
    expect(ensNamehash("VITALIK.ETH")).toBe(ensNamehash("vitalik.eth"));
  });

  it("matches the ENSIP-1 spec vector for 'foo.eth'", () => {
    expect(ensNamehash("foo.eth")).toBe("de9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f");
  });
});

describe("EIP-55 checksums", () => {
  it("checksums known addresses", () => {
    expect(toChecksumAddress(VITALIK)).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(toChecksumAddress("0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED")).toBe(
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    );
  });

  it("passes all-lower and all-upper through", () => {
    expect(toChecksumAddress("0X52908400098527886E0F7030069857D2E4169EE7")).toBe(
      "0x52908400098527886E0F7030069857D2E4169EE7",
    );
  });
});

describe("ABI decoding", () => {
  it("decodes a dynamic string return (USDC symbol payload)", () => {
    // Captured live: symbol() on 0xa0b8…eb48
    const data =
      "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000";
    expect(decodeEvmString(data)).toBe("USDC");
  });

  it("rejects short or malformed payloads", () => {
    expect(decodeEvmString("0x")).toBeNull();
    expect(decodeEvmString("0x" + "00".repeat(63))).toBeNull();
  });

  it("converts hex quantities", () => {
    expect(hexToBigInt("0x")).toBe(0n);
    expect(hexToBigInt("0x64")).toBe(100n);
  });

  it("formats wei for display", () => {
    expect(formatWei(1_500_000_000_000_000_000n, 18)).toBe("1.5000");
    expect(formatWei(50_000_000n, 18, 2)).toBe("0.00");
  });
});

describe("EIP-7702 delegation", () => {
  it("classifies delegated EOAs and extracts the delegate", async () => {
    const delegatedCode = "0xef01005a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: delegatedCode }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { classifyAddress } = await import("@/lib/atomic/onchain/adapter");
    const cls = await classifyAddress("ethereum", VITALIK);
    vi.unstubAllGlobals();
    expect(cls).not.toBeNull();
    expect(cls!.isContract).toBe(false);
    expect(cls!.delegation?.delegate).toBe("0x5a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d");
  });

  it("treats short or partial designators as contracts, not delegations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xef0100abcd" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { classifyAddress } = await import("@/lib/atomic/onchain/adapter");
    const cls = await classifyAddress("ethereum", VITALIK);
    vi.unstubAllGlobals();
    expect(cls!.isContract).toBe(true);
    expect(cls!.delegation).toBeNull();
  });
});

describe("bytecode selector scan", () => {
  it("detects mint and blacklist surfaces", async () => {
    const code = "0x" + "6080" + "40c10f19" + "14" + "5c975abb" + "63" + "f2fde38b" + "00";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: code }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const scan = await scanBytecode("ethereum", VITALIK);
    vi.unstubAllGlobals();
    expect(scan).not.toBeNull();
    expect(scan!.codeSizeBytes).toBeGreaterThan(0);
    const labels = scan!.selectors.map((s) => s.label);
    expect(labels).toContain("mint");
    expect(labels).toContain("blacklist");
    expect(labels).toContain("transferOwnership");
  });

  it("selector list stays canonical and unique", () => {
    const selectors = BYTECODE_SELECTORS.map((s) => s.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
    for (const s of selectors) expect(s).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("rpc client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns parsed results on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x10d4f" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await rpcCall<string>("ethereum", "eth_blockNumber", [], { retries: 0 });
    expect(result).toBe("0x10d4f");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails over to the next endpoint on transport failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: "0x1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await rpcCall<string>("base", "eth_blockNumber", [], { retries: 0 });
    expect(result).toBe("0x1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats JSON-RPC error envelopes as endpoint failures and eventually throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "method not allowed" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(rpcCall<string>("polygon", "eth_blockNumber", [], { retries: 0 })).rejects.toBeInstanceOf(RpcError);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("aborts slow endpoints", async () => {
    // simulate a real fetch that honors its abort signal
    const fetchMock = vi.fn().mockImplementation(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("The operation was aborted")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(rpcCall<string>("bnb", "eth_blockNumber", [], { retries: 0, timeoutMs: 50 })).rejects.toBeInstanceOf(RpcError);
  }, 3_000);
});

describe("ENS resolution guards", () => {
  it("rejects malformed names without RPC", async () => {
    expect(await resolveEns("not-an-ens")).toBeNull();
    expect(await resolveEns("bad_domain.eth")).toBeNull();
    expect(await resolveEns("")).toBeNull();
  });
});

describe("onchain facts caching", () => {
  beforeEach(() => {
    process.env.ATOMIC_DISABLE_LIVE = "1";
  });
  afterAll(() => {
    delete process.env.ATOMIC_DISABLE_LIVE;
  });

  it("is disabled when ATOMIC_DISABLE_LIVE=1", async () => {
    expect(await onchainFacts("ethereum", VITALIK)).toBeNull();
  });
});

describe("webhook URL validation", () => {
  it("accepts public http(s) URLs", () => {
    expect(isValidWebhookUrl("https://hooks.example.com/atomic")).toBe(true);
    expect(isValidWebhookUrl("http://status.example.org/hook")).toBe(true);
  });

  it("rejects loopback, private ranges, and non-http schemes", () => {
    expect(isValidWebhookUrl("http://localhost:8080/hook")).toBe(false);
    expect(isValidWebhookUrl("http://127.0.0.1/hook")).toBe(false);
    expect(isValidWebhookUrl("http://10.1.2.3/hook")).toBe(false);
    expect(isValidWebhookUrl("http://192.168.0.4/hook")).toBe(false);
    expect(isValidWebhookUrl("http://172.16.5.5/hook")).toBe(false);
    expect(isValidWebhookUrl("http://169.254.1.1/latest/meta-data")).toBe(false);
    expect(isValidWebhookUrl("file:///etc/passwd")).toBe(false);
    expect(isValidWebhookUrl("ftp://hooks.example.com")).toBe(false);
    expect(isValidWebhookUrl("https://team.local/hook")).toBe(false);
    expect(isValidWebhookUrl("not a url")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("allows bursts up to the limit then returns retry-after", () => {
    const t0 = 1_000_000;
    let now = t0;
    const opts = { rpm: 3, windowMs: 60_000 };
    expect(rateLimit("k1", opts, now).ok).toBe(true);
    now += 1000;
    expect(rateLimit("k1", opts, now).ok).toBe(true);
    now += 1000;
    expect(rateLimit("k1", opts, now).ok).toBe(true);
    now += 1000;
    const blocked = rateLimit("k1", opts, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("frees the window after it expires", () => {
    const t0 = 2_000_000;
    const opts = { rpm: 1, windowMs: 5_000 };
    expect(rateLimit("k2", opts, t0).ok).toBe(true);
    expect(rateLimit("k2", opts, t0 + 1000).ok).toBe(false);
    expect(rateLimit("k2", opts, t0 + 5_001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { rpm: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts, 3_000_000).ok).toBe(true);
    expect(rateLimit("b", opts, 3_000_000).ok).toBe(true);
    expect(rateLimit("a", opts, 3_000_000).ok).toBe(false);
  });
});
