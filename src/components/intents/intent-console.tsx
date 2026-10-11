"use client";

import { useMemo, useState } from "react";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { TOKENS } from "@/lib/atomic/engine/tokens";
import { isEvmAddress } from "@/lib/atomic/engine/prng";
import { stageIntent } from "@/lib/atomic/intents/builder";
import { useWorkspace } from "@/lib/atomic/workspace";
import { Badge, CheckStatusIcon, Panel, SectionHeader } from "@/components/ui";
import type { IntentKind, StagedIntent } from "@/lib/atomic/types";

const OPERATOR = "0xa70f1c00000000000000000000000000000a70f1"; // demo operator wallet

const KINDS: { id: IntentKind; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "transfer", label: "Transfer" },
  { id: "approve", label: "Approve" },
  { id: "contract-call", label: "Contract call" },
];

function IntentCard({ intent }: { intent: StagedIntent }) {
  const { setIntentState } = useWorkspace();
  const [confirmChecked, setConfirmChecked] = useState(false);
  const approved = intent.state === "approved";

  return (
    <div className={`panel panel-pad ${approved ? "border-emerald-900/50" : intent.securityScore < 60 ? "border-red-900/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-mist-dim">{intent.id}</span>
        <Badge tone="cyan">{intent.kind}</Badge>
        <Badge>{intent.chain}</Badge>
        {approved ? (
          <Badge tone="green">approved — ready to sign</Badge>
        ) : (
          <Badge tone="amber">awaiting review</Badge>
        )}
        <span className="ml-auto font-mono text-[11px] text-mist-dim">security {intent.securityScore}/100</span>
      </div>

      <p className="mt-3 text-sm text-mist-bright">{intent.summary}</p>

      <div className="mt-3 space-y-1.5">
        {intent.securityNotes.map((n, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <CheckStatusIcon status={n.status} />
            <span className={n.status === "fail" ? "text-red-300" : n.status === "warn" ? "text-amber-300" : "text-mist"}>{n.text}</span>
          </div>
        ))}
      </div>

      <details className="mt-3 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3">
        <summary className="cursor-pointer font-mono text-[11px] text-mist-dim">Unsigned EIP-712 typed data (view payload)</summary>
        <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-mist-dim">{JSON.stringify(intent.typedData, null, 2)}</pre>
      </details>

      {approved ? (
        <div className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-xs leading-relaxed text-emerald-200">
          <p className="font-medium">Approved for execution in your wallet.</p>
          <p className="mt-1 text-emerald-300/80">
            ATOMIC is non-custodial: sign this typed data with your own wallet to execute. Nothing is broadcast by ATOMIC and no keys are held. Keep this payload only if you intend to sign it.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-danger" onClick={() => setIntentState(intent.id, "discarded")}>
              Discard payload
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-mist">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="h-4 w-4 accent-cyan-400"
            />
            I reviewed the recipient, checks, and payload
          </label>
          <button
            className="btn-primary"
            disabled={!confirmChecked}
            onClick={() => setIntentState(intent.id, "approved")}
          >
            Approve intent
          </button>
          <button className="btn-ghost" onClick={() => setIntentState(intent.id, "discarded")}>
            Discard
          </button>
          {intent.securityScore < 60 && (
            <span className="text-xs text-red-300">Failed checks present — approval is strongly discouraged.</span>
          )}
        </div>
      )}
    </div>
  );
}

export function IntentConsole({ presetTo }: { presetTo: string }) {
  const { stagedIntents, addIntent } = useWorkspace();
  const [kind, setKind] = useState<IntentKind>("swap");
  const [chain, setChain] = useState(CHAIN_LIST[1].id);
  const [to, setTo] = useState(presetTo);
  const [inputToken, setInputToken] = useState("USDC");
  const [outputToken, setOutputToken] = useState("WETH");
  const [amount, setAmount] = useState("2500");
  const [slippage, setSlippage] = useState("0.5");
  const [memo, setMemo] = useState("");

  const toValid = isEvmAddress(to);
  const amountNum = Number(amount);
  const canBuild = toValid && !Number.isNaN(amountNum) && amountNum > 0;

  const live = useMemo(() => {
    if (!canBuild) return null;
    return stageIntent({
      kind,
      chain,
      from: OPERATOR,
      to: to.trim().toLowerCase(),
      inputToken: kind === "contract-call" ? undefined : inputToken,
      outputToken: kind === "swap" ? outputToken : undefined,
      amount: kind === "contract-call" ? undefined : amountNum,
      slippagePct: kind === "swap" ? Number(slippage) : undefined,
      memo,
    });
    // recompute on field change — pure function, cheap
  }, [kind, chain, to, inputToken, outputToken, amountNum, slippage, memo, canBuild]);

  const active = stagedIntents.filter((i) => i.state !== "discarded");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <SectionHeader title="Prepare intent" sub="Compile an action into a signable payload — nothing leaves this workspace" />
        <div className="space-y-4">
          <div>
            <div className="label-mono mb-2">Action</div>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={k.id === kind ? "btn-primary" : "btn-ghost"}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="intent-chain" className="label-mono">Chain</label>
              <select id="intent-chain" className="input mt-1.5" value={chain} onChange={(e) => setChain(e.target.value as typeof chain)}>
                {CHAIN_LIST.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="intent-kind-token" className="label-mono">{kind === "swap" ? "Input token" : "Token"}</label>
              <select
                id="intent-kind-token"
                className="input mt-1.5"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                disabled={kind === "contract-call"}
              >
                {TOKENS.filter((t) => !t.demo).map((t) => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>
          </div>

          {kind === "swap" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="intent-out" className="label-mono">Output token</label>
                <select id="intent-out" className="input mt-1.5" value={outputToken} onChange={(e) => setOutputToken(e.target.value)}>
                  {TOKENS.filter((t) => !t.demo).map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="intent-slip" className="label-mono">Max slippage %</label>
                <input id="intent-slip" className="input mt-1.5 font-mono" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="intent-to" className="label-mono">Recipient / contract</label>
            <input
              id="intent-to"
              className={`input mt-1.5 font-mono ${to && !toValid ? "!border-red-800" : ""}`}
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            {to && !toValid && <p className="mt-1 text-xs text-red-400">Not a valid EVM address.</p>}
          </div>

          {kind !== "contract-call" && (
            <div>
              <label htmlFor="intent-amount" className="label-mono">Amount</label>
              <input id="intent-amount" className="input mt-1.5 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}

          <div>
            <label htmlFor="intent-memo" className="label-mono">Memo (embedded in payload)</label>
            <input id="intent-memo" className="input mt-1.5" placeholder="optional context, e.g. ops:october-rebalance" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          {live && (
            <div className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="label-mono">Pre-flight scan</span>
                <span className={`font-mono text-xs ${live.securityScore >= 80 ? "text-emerald-400" : live.securityScore >= 55 ? "text-amber-400" : "text-red-400"}`}>
                  {live.securityScore}/100
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {live.securityNotes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckStatusIcon status={n.status} />
                    <span className={n.status === "fail" ? "text-red-300" : n.status === "warn" ? "text-amber-300" : "text-mist"}>{n.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={!live}
            onClick={() => {
              if (live) {
                addIntent({ ...live, id: `int_${Math.random().toString(36).slice(2, 12)}`, createdAt: new Date().toISOString() });
              }
            }}
          >
            Stage intent for review
          </button>
          <p className="text-[11px] leading-relaxed text-mist-dim">
            Staging records the payload in this workspace only. Approval is a review state — execution always happens in your own wallet, and ATOMIC never holds keys or broadcasts transactions.
          </p>
        </div>
      </Panel>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-white">Staged intents</h2>
          <span className="font-mono text-[11px] text-mist-dim">{active.length} active</span>
        </div>
        {active.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-ink-600 text-center">
            <p className="text-sm text-mist-bright">No staged intents</p>
            <p className="mt-1 text-xs text-mist-dim">Prepare an action on the left — it will appear here for review.</p>
          </div>
        ) : (
          active.map((intent) => <IntentCard key={intent.id} intent={intent} />)
        )}
      </div>
    </div>
  );
}
