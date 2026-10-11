"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { isEvmAddress } from "@/lib/atomic/engine/prng";

export function AddressScanForm({ initial = "", initialChain, label = "Contract or address", cta = "Run audit" }: { initial?: string; initialChain?: string; label?: string; cta?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [chain, setChain] = useState(initialChain ?? "");
  const valid = isEvmAddress(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const params = new URLSearchParams({ address: value.trim().toLowerCase() });
        if (chain) params.set("chain", chain);
        router.push(`/security?${params.toString()}`);
      }}
    >
      <label htmlFor="scan-addr" className="label-mono">
        {label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="scan-addr"
          className="input font-mono"
          placeholder="0x…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <select
          aria-label="Chain to probe"
          className="input w-32 shrink-0 font-mono text-xs"
          value={chain}
          onChange={(e) => setChain(e.target.value)}
        >
          <option value="">auto</option>
          {CHAIN_LIST.map((c) => (
            <option key={c.id} value={c.id}>
              {c.short}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary shrink-0" disabled={!valid}>
          {cta}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-mist-dim">
        “Auto” probes the chains where the investigation profile places the subject; pick a chain to force a live read there.
      </p>
    </form>
  );
}
