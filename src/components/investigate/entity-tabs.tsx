"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";

export interface EntityTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Client-state tabs for the entity view. Switching happens in React, not
 * through the router — same-route `?tab=` Link navigation intermittently
 * no-ops in Chromium right after a page loads (Next.js 15.5 router-cache
 * quirk), so the tab bar never touches the router. The URL is kept in
 * sync with history.replaceState instead: tabs stay deep-linkable and
 * refresh-stable without a navigation round-trip.
 */
export function EntityTabs({ tabs, initialTab, basePath }: { tabs: EntityTab[]; initialTab: string; basePath: string }) {
  const [active, setActive] = useState(initialTab);

  const select = useCallback(
    (id: string) => {
      setActive(id);
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", `${basePath}?tab=${id}`);
      }
    },
    [basePath],
  );

  return (
    <div>
      <div className="mt-8 flex gap-1 border-b border-ink-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            aria-current={active === t.id ? "page" : undefined}
            className={`rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
              active === t.id ? "border-x border-t border-ink-700 bg-ink-850 text-white" : "text-mist hover:text-mist-bright"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}
