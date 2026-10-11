import { PageHeader } from "@/components/ui";
import { PortfolioConsole } from "@/components/portfolio/portfolio-console";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operations · Portfolio"
        title="Portfolio, treasury & NFT monitoring"
        sub="Aggregated view across the workspace watchlist and the ATOMIC demo treasury. Add subjects to the watchlist from any investigation to expand coverage."
      />
      <PortfolioConsole />
    </div>
  );
}
