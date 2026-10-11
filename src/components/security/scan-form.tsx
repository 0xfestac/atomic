"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isEvmAddress } from "@/lib/atomic/engine/prng";

export function AddressScanForm({ initial = "", label = "Contract or address", cta = "Run audit" }: { initial?: string; label?: string; cta?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const valid = isEvmAddress(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/security?address=${value.trim().toLowerCase()}`);
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
        <button type="submit" className="btn-primary shrink-0" disabled={!valid}>
          {cta}
        </button>
      </div>
    </form>
  );
}
