import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CHAIN_LIST, chainOrNull, isChainId } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";

const FILE = join(mkdtempSync(join(tmpdir(), "atomic-chains-")), "chains.json");

const ZKSYNC = {
  id: "zksync-era",
  name: "zkSync Era",
  evmChainId: 324,
  nativeSymbol: "ETH",
  rpc: ["https://mainnet.era.zksync.io"],
  explorer: "https://explorer.zksync.io",
};

const builtinCount = CHAIN_LIST.length;

function writeConfig(value: unknown): void {
  writeFileSync(FILE, JSON.stringify(value, null, 2));
}

afterEach(() => {
  delete process.env.ATOMIC_CHAINS_FILE;
  rmSync(FILE, { force: true });
});

describe("ensureChains — ATOMIC_CHAINS_FILE hot reload", () => {
  it("is a no-op without ATOMIC_CHAINS_FILE", async () => {
    await ensureChains({ force: true });
    expect(CHAIN_LIST.length).toBe(builtinCount);
  });

  it("applies the file, re-applies edits, and reverts when it disappears", async () => {
    process.env.ATOMIC_CHAINS_FILE = FILE;

    // Missing file → env-only registry, no crash.
    await ensureChains({ force: true });
    expect(CHAIN_LIST.length).toBe(builtinCount);

    // File appears → chain installed in place.
    writeConfig([ZKSYNC]);
    await ensureChains({ force: true });
    expect(isChainId("zksync-era")).toBe(true);
    expect(CHAIN_LIST.length).toBe(builtinCount + 1);
    expect(chainOrNull("zksync-era")?.explorer).toBe("https://explorer.zksync.io");

    // File edited → patch applied on the next check.
    writeConfig([{ id: "base", explorer: "https://explorer.example.com" }]);
    await ensureChains({ force: true });
    expect(isChainId("zksync-era")).toBe(false);
    expect(chainOrNull("base")?.explorer).toBe("https://explorer.example.com");

    // File removed → back to env-only configuration.
    rmSync(FILE, { force: true });
    await ensureChains({ force: true });
    expect(CHAIN_LIST.length).toBe(builtinCount);
    expect(chainOrNull("base")?.explorer).toBe("https://basescan.org");
  });

  it("keeps the previous registry when the file becomes invalid JSON", async () => {
    process.env.ATOMIC_CHAINS_FILE = FILE;
    writeConfig([ZKSYNC]);
    await ensureChains({ force: true });
    expect(isChainId("zksync-era")).toBe(true);

    writeFileSync(FILE, "{not json");
    await ensureChains({ force: true });
    // Unparseable file is ignored; env-only registry stays active.
    expect(isChainId("zksync-era")).toBe(false);
    expect(CHAIN_LIST.length).toBe(builtinCount);
  });
});
