"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ShortcutSheet from "@/components/ShortcutSheet";
import { useTasks } from "@/lib/store-context";
import { addDays, toISODate } from "@/lib/parse";
import { isTypingTarget, matchShortcut } from "@/lib/shortcuts";
import { focusWhenReady } from "@/lib/focus-when-ready";

const SELECTED = "data-kbd-selected";
const BLOCKING = '[role="dialog"], [role="alertdialog"], [role="menu"]';

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
}

function rowFor(id: string | null): HTMLElement | null {
  if (!id) return null;
  return rows().find((r) => r.getAttribute("data-task-id") === id) ?? null;
}

function clearMarks() {
  document.querySelectorAll(`[${SELECTED}]`).forEach((el) => el.removeAttribute(SELECTED));
}

/**
 * Row keys and the ? sheet. Mounted once in the workspace chrome. The
 * highlight is a DOM attribute (TaskRow styles it) so list re-renders never
 * fight it; this component only re-applies it when the task list changes.
 */
export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const api = useTasks();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The announcement remembers the route it was made on, so a route change
  // hides it without an effect having to reset state.
  const [announced, setAnnounced] = useState({ path: pathname, text: "" });
  const selectedId = useRef<string | null>(null);

  const latest = useRef({ api, router, pathname });
  useEffect(() => {
    latest.current = { api, router, pathname };
  });

  const setAnnouncement = useCallback((text: string) => {
    setAnnounced({ path: latest.current.pathname, text });
  }, []);

  const select = useCallback((el: HTMLElement | null) => {
    clearMarks();
    if (!el) {
      selectedId.current = null;
      setAnnouncement("");
      return;
    }
    el.setAttribute(SELECTED, "true");
    selectedId.current = el.getAttribute("data-task-id");
    el.scrollIntoView?.({ block: "nearest" });
    const title = latest.current.api.tasks.find((t) => t.id === selectedId.current)?.title;
    setAnnouncement(title ?? "");
  }, [setAnnouncement]);

  // New page, new list: drop the selection.
  useEffect(() => {
    clearMarks();
    selectedId.current = null;
  }, [pathname]);

  // Rows re-render or vanish when tasks change; keep the mark honest.
  useEffect(() => {
    if (!selectedId.current) return;
    const el = rowFor(selectedId.current);
    if (!el) {
      selectedId.current = null;
      setAnnouncement("");
    } else if (!el.hasAttribute(SELECTED)) {
      clearMarks();
      el.setAttribute(SELECTED, "true");
    }
  }, [api.tasks, setAnnouncement]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;
      if (document.querySelector(BLOCKING)) return;
      const action = matchShortcut(event);
      if (!action) return;

      const { api, router } = latest.current;
      const idle = document.activeElement === null || document.activeElement === document.body;
      if ((action === "open" || action === "done") && event.key !== "x" && event.key !== "e" && !idle) {
        return;
      }

      if (action === "sheet") {
        event.preventDefault();
        setSheetOpen(true);
        return;
      }

      if (action === "quickAdd") {
        event.preventDefault();
        if (document.getElementById("doem-quick-add")) focusWhenReady("doem-quick-add");
        else if (document.getElementById("doem-inbox-quick-add")) focusWhenReady("doem-inbox-quick-add");
        else {
          router.push("/");
          focusWhenReady("doem-quick-add");
        }
        return;
      }

      const all = rows();
      const current = rowFor(selectedId.current);
      if (!current) selectedId.current = null;

      if (action === "next" || action === "prev") {
        event.preventDefault();
        if (all.length === 0) return;
        const index = current ? all.indexOf(current) : -1;
        let target: HTMLElement;
        if (index === -1) target = action === "next" ? all[0] : all[all.length - 1];
        else target = all[Math.min(all.length - 1, Math.max(0, index + (action === "next" ? 1 : -1)))];
        select(target);
        return;
      }

      const id = selectedId.current;
      if (!id || !current) return;
      const task = api.tasks.find((t) => t.id === id);
      if (!task) return;
      event.preventDefault();
      const todayISO = toISODate(new Date());

      switch (action) {
        case "done":
          void (task.status === "done" ? api.reopenTask(id) : api.completeTask(id));
          break;
        case "tomorrow":
          void api.rescheduleTasks([id], addDays(todayISO, 1));
          break;
        case "pickDate": {
          const trigger = current.querySelector<HTMLElement>('[aria-label="Not today"]');
          if (trigger) trigger.click();
          else api.openTask(id);
          break;
        }
        case "timer":
          void (api.running?.taskId === id ? api.stopTimer() : api.startTimer(id));
          break;
        case "focus":
          if (api.focus?.taskId === id || task.status === "done") break;
          void api.startFocus(task);
          break;
        case "commit": {
          const star = Array.from(current.querySelectorAll<HTMLElement>("button[aria-label]")).find((b) => {
            const label = b.getAttribute("aria-label") ?? "";
            return label.startsWith("Add to Today's") || label.startsWith("Remove from Today's");
          });
          if (star) star.click();
          else {
            void api.commitTask(id, todayISO).then((r) => {
              if (r && r.ok === false) api.openTask(id);
            });
          }
          break;
        }
        case "open":
          api.openTask(id);
          break;
        case "trash": {
          const index = all.indexOf(current);
          const neighbour = all[index + 1] ?? all[index - 1] ?? null;
          void api.trashTask(id);
          if (neighbour) select(neighbour);
          else select(null);
          break;
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [select]);

  return (
    <>
      <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <div className="sr-only" aria-live="polite">
        {announced.path === pathname ? announced.text : ""}
      </div>
    </>
  );
}
