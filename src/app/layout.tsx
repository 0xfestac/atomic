import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/lib/atomic/workspace";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = {
  title: {
    default: "ATOMIC — Web3 Intelligence & Operations",
    template: "%s · ATOMIC",
  },
  description:
    "ATOMIC is a multi-chain Web3 intelligence and operations platform: discover, investigate, verify, explain, and act — with deterministic security checks and non-custodial, user-approved execution.",
  applicationName: "ATOMIC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const live = process.env.ATOMIC_DISABLE_LIVE !== "1";
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-mist-bright antialiased">
        <WorkspaceProvider>
          <Sidebar />
          <div className="pl-60">
            <Topbar liveRpc={live} />
            <main className="mx-auto max-w-7xl px-8 py-8">{children}</main>
            <footer className="border-t border-ink-700 px-8 py-6">
              <p className="text-[11px] text-mist-dim">
                ATOMIC · multi-chain intelligence & operations · non-custodial by design — actions require explicit user approval and are executed from your own wallet · demo dataset is deterministic and for research only
              </p>
            </footer>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
