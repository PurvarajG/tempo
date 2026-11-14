"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import type { DoemCommand } from "@/lib/desktop-bridge";
import { planAway } from "@/lib/away";
import { dockBadgeCount } from "@/lib/dock-badge";
import { addDays, toISODate } from "@/lib/parse";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { openCommandPalette } from "./CommandPalette";
import { focusWhenReady } from "@/lib/focus-when-ready";

const ROUTE_BY_DIGIT: Record<string, string> = {
  "0": "/inbox",
  "1": "/",
  "2": "/calendar",
  "3": "/tracking",
  "4": "/upcoming",
  "5": "/all",
};

type Workspace = ReturnType<typeof useTasks>;

/**
 * Main-process-only command: the menu bar started, stopped or switched
 * tracking through the API. Kept here rather than in DoemCommand because
 * nothing else sends it.
 */
type TrayCommand = { type: "tracking-changed" };

/** Re-reads what is being timed after something outside this window changed it. */
async function resyncTracking(ws: Workspace) {
  try {
    const now = new Date().toISOString();
    const [time, segs] = await Promise.all([
      fetch("/api/time-entries").then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/segments?from=${encodeURIComponent(now)}&to=${encodeURIComponent(now)}`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ]);
    if (time && Array.isArray(time.entries)) {
      ws.setTimeEntries(time.entries);
      ws.setRunning(time.running ?? null);
    }
    if (segs) ws.setRunningSegment(segs.running ?? null);
  } catch {
    // The next start, stop or reload catches up.
  }
}

async function refreshTasks(setTasks: Workspace["setTasks"]) {
  try {
    const res = await fetch("/api/tasks");
    if (!res.ok) return;
    const next = await res.json();
    if (Array.isArray(next)) setTasks(next);
  } catch {
    // A failed refresh leaves the list as it was; the next one catches up.
  }
}

/**
 * Applies the away-from-desk choice (4.2) to whatever is being timed. The
 * time-entry PATCH route cannot set endedAt, so an entry is stopped now and
 * its minutes are corrected to the planned end.
 */
async function applyAway(ws: Workspace, choice: "keep" | "break" | "discard", awayFrom: string, awayTo: string) {
  const entry = ws.running;
  const segment = ws.runningSegment;
  const startedAt = entry?.startedAt ?? segment?.startedAt;
  if (!startedAt) return;
  const plan = planAway(choice, startedAt, awayFrom, awayTo);
  if (plan.kind === "none" || plan.kind === "keep") return;
  const rest = ws.categories.find((c) => c.kind === "rest" && !c.archived);

  if (entry) {
    await ws.stopTimer();
    const minutes = Math.max(1, Math.round((new Date(plan.endAt).getTime() - new Date(entry.startedAt).getTime()) / 60_000));
    await ws.patchTimeEntry(entry.id, { minutes });
    if (plan.kind === "break") {
      if (rest) await ws.addManualSegment({ categoryId: rest.id, startedAt: plan.restFrom, endedAt: plan.restTo });
      await ws.startTimer(entry.taskId);
    }
    return;
  }

  if (!segment) return;
  const halves = await ws.splitSegmentAt(segment.id, plan.endAt);
  if (!halves) return;
  await ws.stopSegment();
  if (plan.kind === "discard") {
    await ws.deleteSegment(halves.after.id);
    return;
  }
  if (rest) await ws.patchSegment(halves.after.id, { categoryId: rest.id, endedAt: plan.resumeAt });
  else await ws.deleteSegment(halves.after.id);
  await ws.startSegment(
    segment.taskId
      ? { taskId: segment.taskId, activityId: segment.activityId, note: segment.note }
      : { categoryId: segment.categoryId, activityId: segment.activityId, note: segment.note },
  );
}

/**
 * Mounted once in AppChrome beside the other cross-page singletons. Bridges
 * native menu/keyboard commands onto the same router and workspace actions
 * every page already uses — no command gets a state layer of its own.
 */
export default function DesktopBridge() {
  const router = useRouter();
  const workspace = useTasks();
  const { tasks, running, openTaskId, undoOffer, undo, settings } = workspace;
  const { captureShortcut, nudgeMinutes, dockBadge, claudeAwareness } = withSettingsDefaults(settings);

  // Commands need whatever is current when they arrive, not whatever was
  // current when the subscription below was set up.
  const stateRef = useRef(workspace);
  useEffect(() => {
    stateRef.current = workspace;
  });

  // Cmd/Ctrl+Z reads the current offer through a ref so its listener is
  // registered once.
  const undoRef = useRef({ undoOffer, undo });
  useEffect(() => {
    undoRef.current = { undoOffer, undo };
  });

  // Runs in both the web and Electron builds. Calling preventDefault is what
  // stops the native Edit-menu undo from also firing.
  useEffect(() => {
    function isTextField(el: EventTarget | Element | null) {
      if (!(el instanceof HTMLElement)) return false;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el.isContentEditable ||
        el.contentEditable === "true"
      );
    }
    function onUndoKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      if (isTextField(event.target) || isTextField(document.activeElement)) return;
      const { undoOffer, undo } = undoRef.current;
      if (!undoOffer) return;
      event.preventDefault();
      void undo();
    }
    document.addEventListener("keydown", onUndoKey, true);
    return () => document.removeEventListener("keydown", onUndoKey, true);
  }, []);

  useEffect(() => {
    function run(command: DoemCommand | TrayCommand) {
      switch (command.type) {
        case "tracking-changed":
          void resyncTracking(stateRef.current);
          break;
        case "navigate":
          router.push(command.path);
          break;
        case "focus-search":
          openCommandPalette();
          break;
        case "new-task":
          router.push("/");
          focusWhenReady("doem-quick-add");
          break;
        case "toggle-timer": {
          const { running, openTaskId, startTimer, stopTimer } = stateRef.current;
          if (running) void stopTimer();
          else if (openTaskId) void startTimer(openTaskId);
          break;
        }
        case "refresh-tasks":
          void refreshTasks(stateRef.current.setTasks);
          break;
        case "reminder-start": {
          const { running, startTimer, switchTimer } = stateRef.current;
          if (running?.taskId === command.taskId) break;
          if (running) void switchTimer(command.taskId);
          else void startTimer(command.taskId);
          break;
        }
        case "reminder-tomorrow":
          void stateRef.current.rescheduleTasks([command.taskId], addDays(toISODate(new Date()), 1));
          break;
        case "away":
          void applyAway(stateRef.current, command.choice, command.awayFrom, command.awayTo);
          break;
      }
    }

    if (window.doem) return window.doem.onCommand(run);

    // The web build has no native menu, so the same accelerators are wired
    // directly to the keyboard here instead. This branch never runs under
    // Electron — the menu already sends the matching command over IPC, and
    // handling both would fire every action twice.
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const digitRoute = ROUTE_BY_DIGIT[event.key];
      if (digitRoute) {
        event.preventDefault();
        run({ type: "navigate", path: digitRoute });
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        run({ type: "new-task" });
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        run({ type: "focus-search" });
      } else if (event.key === ",") {
        event.preventDefault();
        run({ type: "navigate", path: "/settings" });
      } else if (event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        run({ type: "toggle-timer" });
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [router]);

  // The badge is date-dependent, so it re-derives at local midnight too.
  const [today, setToday] = useState(() => toISODate(new Date()));
  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const id = setTimeout(() => setToday(toISODate(new Date())), next.getTime() - now.getTime() + 1000);
    return () => clearTimeout(id);
  }, [today]);

  useEffect(() => {
    window.doem?.setBadge(dockBadgeCount(tasks, today, dockBadge));
  }, [tasks, today, dockBadge]);

  // Main owns the capture shortcut and the nudge timer; it needs both values.
  useEffect(() => {
    window.doem?.setDesktopSettings?.({ captureShortcut, nudgeMinutes, claudeAwareness });
  }, [captureShortcut, nudgeMinutes, claudeAwareness]);

  // Tells the Tray something started, stopped or switched. Main re-reads the
  // running segment itself and ticks the elapsed time, so this only needs to
  // fire on change — for a task timer or for activity tracking (no task).
  const { runningSegment } = workspace;
  useEffect(() => {
    if (!running && !runningSegment) {
      window.doem?.setTimerStatus(null);
      return;
    }
    const taskId = running?.taskId ?? runningSegment?.taskId;
    const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
    const startedAt = running?.startedAt ?? runningSegment!.startedAt;
    window.doem?.setTimerStatus({ label: task?.title ?? "Timing", startedAt });
  }, [running, runningSegment, tasks]);

  // Task ▸ Start/Stop Timer has nothing to act on unless a timer is running
  // or a task panel is open — keep the native menu item's enabled state in
  // sync so it can't be clicked (or fired via its accelerator) into a no-op.
  useEffect(() => {
    window.doem?.setCanToggleTimer(Boolean(running || openTaskId));
  }, [running, openTaskId]);

  return null;
}
