/**
 * Minimal, dependency-free Keccak-256 (the pre-standard variant used by
 * Ethereum). Needed for ENS namehash (EIP-137) and EIP-55 address
 * checksums. Verified against canonical test vectors in tests/onchain.test.ts.
 */

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// rho-pi route: lane (1,0) is rotated by RHO[0] and lands at PI[0], and so on.
// Destination index of step t: (x,y) -> (y, (2x+3y) mod 5), index = x + 5y.
const PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
const RHO = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];

const MASK = (1n << 64n) - 1n;

function rotl(v: bigint, n: number): bigint {
  return ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;
}

function keccakF(state: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    const c: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) state[y + x] = (state[y + x] ^ d) & MASK;
    }
    let t = state[1];
    for (let i = 0; i < 24; i++) {
      const j = PI[i];
      const tmp = state[j];
      state[j] = rotl(t, RHO[i]);
      t = tmp;
    }
    for (let y = 0; y < 25; y += 5) {
      const row = state.slice(y, y + 5);
      for (let x = 0; x < 5; x++) {
        state[y + x] = row[x] ^ (~row[(x + 1) % 5] & MASK) & row[(x + 2) % 5];
      }
    }
    state[0] = (state[0] ^ RC[round]) & MASK;
  }
}

function keccak256Bytes(input: Uint8Array): Uint8Array {
  const rate = 136; // bytes, for 256-bit output
  const state = new Array<bigint>(25).fill(0n);

  // absorb full blocks (keccak padding: 0x01 ... 0x80)
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] |= 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate; i += 8) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[offset + i + b]);
      state[i / 8] ^= lane;
    }
    keccakF(state);
  }

  // squeeze 32 bytes, little-endian lanes
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number((state[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 0xffn);
  return out;
}

export function keccak256(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return keccak256Bytes(bytes);
}

export function keccak256Hex(data: Uint8Array | string): string {
  return toHex(keccak256(data));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * EIP-137 namehash. Names are lowercased; empty name hashes to the root.
 * (Full UTS-46 normalization is not attempted here — resolution requests
 * are restricted to a conservative character set at the call sites.)
 */
export function ensNamehash(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === "") return "0".repeat(64);
  const idx = normalized.indexOf(".");
  const label = idx === -1 ? normalized : normalized.slice(0, idx);
  const remainder = idx === -1 ? "" : normalized.slice(idx + 1);
  const parent = ensNamehash(remainder);
  const labelHash = keccak256(label);
  // node = keccak256(parent ++ keccak256(label)) over raw 64 bytes
  const buf = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    buf[i] = Number.parseInt(parent.slice(i * 2, i * 2 + 2), 16);
    buf[32 + i] = labelHash[i];
  }
  return toHex(keccak256(buf));
}

/** EIP-55 mixed-case checksum encoding. */
export function toChecksumAddress(address: string): string {
  const lower = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(lower)) return lower;
  const hash = toHex(keccak256(lower.slice(2)));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    const nibble = Number.parseInt(hash[i], 16);
    out += nibble >= 8 ? lower[2 + i].toUpperCase() : lower[2 + i];
  }
  return out;
}
