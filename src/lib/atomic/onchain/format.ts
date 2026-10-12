/**
 * Pure display helpers shared by server and client bundles. Kept free of
 * any RPC or next/server imports so client components (and modules
 * reachable from them, like the security checks) never pull the onchain
 * adapter into the client graph.
 */

export function formatWei(wei: bigint, decimals: number, display = 4): string {
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const frac = (wei % base).toString().padStart(decimals, "0").slice(0, display);
  return `${whole.toString()}.${frac}`;
}
