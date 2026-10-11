import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { IntentConsole } from "@/components/intents/intent-console";
import { CHAIN_LIST } from "@/lib/atomic/chains";

export const metadata = { title: "Intents" };

export default async function IntentsPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const presetTo = to && /^0x[0-9a-fA-F]{40}$/.test(to) ? to.toLowerCase() : "";

  return (
    <div>
      <PageHeader
        eyebrow="Act · Intents"
        title="Prepare & approve actions"
        sub="Intent-based transaction preparation: compile an action, run deterministic pre-flight checks, review, then approve. Execution is always completed in your own wallet — ATOMIC is non-custodial and never broadcasts."
      />
      <Suspense fallback={<p className="text-sm text-mist">Loading console…</p>}>
        <IntentConsole presetTo={presetTo} chains={CHAIN_LIST} />
      </Suspense>
    </div>
  );
}
