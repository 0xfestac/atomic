"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isEvmAddress } from "@/lib/atomic/engine/prng";
import { isEnsName } from "@/lib/atomic/onchain/name";
import { KNOWN_ENTITIES } from "@/lib/atomic/engine/entities";
import { RiskBadge } from "@/components/ui";
import Link from "next/link";

export function InvestigateSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const valid = isEvmAddress(trimmed) || isEnsName(trimmed);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const q = trimmed.toLowerCase();
          router.push(`/investigate/${isEvmAddress(q) ? q : encodeURIComponent(q)}`);
        }}
        className="panel panel-pad"
      >
        <label htmlFor="addr" className="label-mono">
          Subject address
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="addr"
            className="input font-mono"
            placeholder="0x… or name.eth"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Address to investigate"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={!valid}>
            Investigate
          </button>
        </div>
        <p className="mt-2 text-xs text-mist-dim">
          Paste any EVM address or an ENS name (.eth, resolved live on mainnet). Profiles blend live chain reads with deterministic enrichment.
        </p>
      </form>

      <div className="mt-6">
        <div className="label-mono mb-3">Named subjects</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {KNOWN_ENTITIES.map((e) => (
            <Link
              key={e.address}
              href={`/investigate/${e.address.toLowerCase()}`}
              className="panel flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-ink-600"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-mist-bright">{e.label}</p>
                <p className="truncate font-mono text-[11px] text-mist-dim">{e.address.slice(0, 20)}…</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] text-mist-dim">{e.type}</span>
                <RiskBadge level={e.riskBias >= 30 ? "critical" : e.riskBias >= 10 ? "medium" : "low"} small />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
