"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AlertRule, StagedIntent } from "@/lib/atomic/types";
import { defaultRules } from "@/lib/atomic/alerts/rules";

/**
 * Workspace state (watchlist, alert rules, staged intents, integration
 * toggles) is persisted to localStorage — settings survive reloads and
 * let reviewers verify durable state in QA.
 */

export interface WorkspaceState {
  watchlist: string[];
  alertRules: AlertRule[];
  stagedIntents: StagedIntent[];
  integrations: Record<string, boolean>;
  dismissedEvents: string[];
}

const EMPTY: WorkspaceState = {
  watchlist: [],
  alertRules: defaultRules(),
  stagedIntents: [],
  integrations: {},
  dismissedEvents: [],
};

const KEY = "atomic.workspace.v1";

interface WorkspaceApi extends WorkspaceState {
  hydrated: boolean;
  toggleWatch: (address: string) => void;
  isWatched: (address: string) => boolean;
  upsertRule: (rule: AlertRule) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  addIntent: (intent: StagedIntent) => void;
  setIntentState: (id: string, state: StagedIntent["state"]) => void;
  toggleIntegration: (id: string) => void;
  dismissEvent: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
        setState({
          ...EMPTY,
          ...parsed,
          alertRules: parsed.alertRules ?? EMPTY.alertRules,
        });
      }
    } catch {
      // corrupted storage → start clean
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full / disabled — settings stay in-memory
    }
  }, [state, hydrated]);

  const toggleWatch = useCallback((address: string) => {
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.includes(address)
        ? s.watchlist.filter((a) => a !== address)
        : [...s.watchlist, address],
    }));
  }, []);

  const upsertRule = useCallback((rule: AlertRule) => {
    setState((s) => ({
      ...s,
      alertRules: s.alertRules.some((r) => r.id === rule.id)
        ? s.alertRules.map((r) => (r.id === rule.id ? rule : r))
        : [...s.alertRules, rule],
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setState((s) => ({ ...s, alertRules: s.alertRules.filter((r) => r.id !== id) }));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));
  }, []);

  const addIntent = useCallback((intent: StagedIntent) => {
    setState((s) => ({ ...s, stagedIntents: [intent, ...s.stagedIntents].slice(0, 20) }));
  }, []);

  const setIntentState = useCallback((id: string, intentState: StagedIntent["state"]) => {
    setState((s) => ({
      ...s,
      stagedIntents: s.stagedIntents.map((i) => (i.id === id ? { ...i, state: intentState } : i)),
    }));
  }, []);

  const toggleIntegration = useCallback((id: string) => {
    setState((s) => ({ ...s, integrations: { ...s.integrations, [id]: !s.integrations[id] } }));
  }, []);

  const dismissEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, dismissedEvents: [...s.dismissedEvents, id] }));
  }, []);

  const api = useMemo<WorkspaceApi>(
    () => ({
      ...state,
      hydrated,
      toggleWatch,
      isWatched: (address: string) => state.watchlist.includes(address),
      upsertRule,
      removeRule,
      toggleRule,
      addIntent,
      setIntentState,
      toggleIntegration,
      dismissEvent,
    }),
    [state, hydrated, toggleWatch, upsertRule, removeRule, toggleRule, addIntent, setIntentState, toggleIntegration, dismissEvent],
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
