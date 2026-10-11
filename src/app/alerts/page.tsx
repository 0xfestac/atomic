import { PageHeader } from "@/components/ui";
import { AlertsConsole } from "@/components/alerts/alerts-console";

export const metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operations · Alerts"
        title="Alert rules & research workflows"
        sub="Compose monitoring rules over any subject — risk thresholds, transfer size, contract exposure — and route events to the in-app feed or a webhook."
      />
      <AlertsConsole />
    </div>
  );
}
