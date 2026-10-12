import { PageHeader } from "@/components/ui";
import { AlertsConsole } from "@/components/alerts/alerts-console";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";

export const metadata = { title: "Alerts" };

export default async function AlertsPage() {
  await ensureChains();
  return (
    <div>
      <PageHeader
        eyebrow="Operations · Alerts"
        title="Alert rules & research workflows"
        sub="Compose monitoring rules over any subject — risk thresholds, transfer size, contract exposure — and route events to the in-app feed or a webhook."
      />
      <AlertsConsole chains={CHAIN_LIST} />
    </div>
  );
}
