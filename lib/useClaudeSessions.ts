"use client";

import { useEffect, useState } from "react";
import type { ClaudeSession } from "@/lib/desktop-bridge";
import { useTasks } from "./store-context";
import { withSettingsDefaults } from "./store-context/use-tracking-config";

const EMPTY: ClaudeSession[] = [];

type ClaudeBridge = {
  getClaudeSessions?: () => Promise<ClaudeSession[]>;
  onClaudeSessions?: (cb: (sessions: ClaudeSession[]) => void) => () => void;
};

function bridge(): ClaudeBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { doem?: ClaudeBridge }).doem;
}

export function useClaudeSessions(): ClaudeSession[] {
  const { settings } = useTasks();
  const awareness = withSettingsDefaults(settings).claudeAwareness;
  const available = typeof window !== "undefined" && !!bridge()?.getClaudeSessions;
  const enabled = awareness && available;
  const [sessions, setSessions] = useState<ClaudeSession[]>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    const api = bridge();
    if (!api?.getClaudeSessions) return;
    let cancelled = false;
    api
      .getClaudeSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {});
    const off = api.onClaudeSessions?.((list) => {
      if (!cancelled) setSessions(list);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [enabled]);

  return enabled ? sessions : EMPTY;
}
