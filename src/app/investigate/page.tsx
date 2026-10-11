import { PageHeader } from "@/components/ui";
import { InvestigateSearch } from "@/components/investigate/search";

export const metadata = { title: "Investigate" };

export default function InvestigatePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Investigate"
        title="Entity investigation"
        sub="Resolve any address into a profile: holdings, activity, relationships, security posture, and an analyst report."
      />
      <InvestigateSearch />
    </div>
  );
}
