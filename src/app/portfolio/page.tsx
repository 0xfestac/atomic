import { PageHeader } from "@/components/ui";
import { PortfolioConsole } from "@/components/portfolio/portfolio-console";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  await ensureChains();
  return (
    <div>
      <PageHeader
        eyebrow="Operations · Portfolio"
        title="Portfolio, treasury & NFT monitoring"
        sub="Aggregated view across the workspace watchlist and the ATOMIC demo treasury. Add subjects to the watchlist from any investigation to expand coverage."
      />
      <PortfolioConsole chains={CHAIN_LIST} />
    </div>
  );
}
