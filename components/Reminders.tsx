"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { remindersDue } from "@/lib/reminders";
import type { DoemReminder } from "@/lib/desktop-bridge";
import Button from "@/components/ui/Button";

const promptListeners = new Set<() => void>();

function subscribeToPrompt(notify: () => void) {
  promptListeners.add(notify);
  return () => promptListeners.delete(notify);
}

export const REMINDER_LEAD_MINUTES = 10;

/**
 * Who fires reminders. Under Electron the main process does: this component
 * only sends it today's timed open tasks (over IPC, whenever the list
 * changes) and renders nothing, so reminders fire with the window hidden.
 * In the web build there is no main process, so this falls back to
 * best-effort in-tab notifications: while the tab is open it fires a browser
 * notification the minute a task's due time arrives. No service worker, so
 * nothing fires if the tab isn't open.
 */
export default function Reminders() {
  const { tasks, ready } = useTasks();
  const fired = useRef(new Set<string>());
  const sentKey = useRef<string | null>(null);

  // Both the browser's permission and the saved dismissal are external state,
  // so they're read as a store rather than copied into React by an effect.
  const state = useSyncExternalStore(
    subscribeToPrompt,
    () =>
      typeof Notification === "undefined"
        ? "unsupported"
        : `${Notification.permission}:${localStorage.getItem("reminders-dismissed") ?? ""}`,
    () => null,
  );

  const permission = state && state !== "unsupported" ? (state.split(":")[0] as NotificationPermission) : null;
  const dismissed = state === null || state === "unsupported" || state.endsWith(":1");

  useEffect(() => {
    if (window.doem) {
      // Desktop: hand the list to the main process, only when it changed.
      const setReminders = window.doem.setReminders;
      if (!setReminders || !ready) return;
      const todayISO = toISODate(new Date());
      const list: DoemReminder[] = remindersDue(tasks, todayISO).map((t) => ({
        taskId: t.id,
        title: t.title,
        scheduled: todayISO,
        dueTime: t.dueTime as string,
        leadMinutes: REMINDER_LEAD_MINUTES,
      }));
      const key = JSON.stringify(list);
      if (key === sentKey.current) return;
      sentKey.current = key;
      setReminders.call(window.doem, list);
      return;
    }

    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const check = () => {
      const now = new Date();
      const todayISO = toISODate(now);
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const t of remindersDue(tasks, todayISO)) {
        if (t.dueTime !== hhmm) continue;
        const key = `${t.id}@${t.dueTime}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        new Notification(t.title, { body: "Due now", tag: t.id });
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [tasks, ready]);

  async function enable() {
    await Notification.requestPermission();
    dismiss();
  }

  function dismiss() {
    localStorage.setItem("reminders-dismissed", "1");
    for (const notify of promptListeners) notify();
  }

  // The desktop app needs no in-page permission prompt (main fires them).
  if (typeof window !== "undefined" && window.doem) return null;
  if (dismissed || permission !== "default") return null;

  return (
    <div
      role="region"
      aria-label="Reminders"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-composer bg-surface px-4 py-3 shadow-md ring-1 ring-line"
    >
      <span className="text-secondary text-ink-2">Turn on reminders for tasks with a due time?</span>
      <Button variant="primary" size="sm" icon="bell" onClick={() => void enable()}>
        Turn on
      </Button>
      <Button variant="ghost" size="sm" onClick={dismiss}>
        Not now
      </Button>
    </div>
  );
}
