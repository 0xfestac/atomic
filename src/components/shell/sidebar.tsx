"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtomicLogo, AtomicWordmark } from "@/components/atomic/logo";

const NAV: { section: string; items: { href: string; label: string; hint: string }[] }[] = [
  {
    section: "Intelligence",
    items: [
      { href: "/", label: "Discover", hint: "Multi-chain overview" },
      { href: "/investigate", label: "Investigate", hint: "Entities & relationships" },
      { href: "/tokenomics", label: "Tokenomics", hint: "Supply & vesting" },
    ],
  },
  {
    section: "Assurance",
    items: [
      { href: "/security", label: "Security", hint: "Contract & tx checks" },
      { href: "/intents", label: "Intents", hint: "Prepare & approve actions" },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/portfolio", label: "Portfolio", hint: "Holdings, NFTs, treasury" },
      { href: "/alerts", label: "Alerts", hint: "Rules & workflows" },
      { href: "/integrations", label: "Integrations", hint: "Agents & providers" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-ink-700 bg-ink-900">
      <Link href="/" className="flex items-center gap-3 px-5 pb-5 pt-6">
        <AtomicLogo />
        <AtomicWordmark />
      </Link>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="label-mono px-3 pb-2">{group.section}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`}>
                    <span className="flex-1">
                      {item.label}
                      <span className="block text-[11px] text-mist-dim">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-700 px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] text-mist-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Demo data plane · non-custodial
        </div>
      </div>
    </aside>
  );
}
