"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { fmtDate } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import { layoutToday } from "@/lib/today";
import { todayTasksPrompt } from "@/lib/claude-prompt";
import { matchesQuery, searchProjects, searchTasks } from "@/lib/search";
import { projectColorVar } from "@/lib/types";
import Icon, { type IconName } from "./ui/Icon";
import Kbd from "./ui/Kbd";
import { NAV } from "./Sidebar";
import { focusWhenReady } from "@/lib/focus-when-ready";

const OPEN_EVENT = "doem:command-palette";

/** Opens the palette from anywhere (the TopBar pill, the native Find command). */
export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Row = {
  key: string;
  group: string;
  label: string;
  meta?: string;
  icon?: IconName;
  swatch?: string;
  run: () => void | Promise<void>;
  /** Stays open after running so a status line can show the outcome. */
  stayOpen?: boolean;
};

const HEADER = "px-3 pb-1 pt-4 text-meta text-ink-3";

export default function CommandPalette() {
  const router = useRouter();
  const { tasks, projects, running, openTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const listId = useId();
  const [status, setStatus] = useState("");

  const show = useCallback(() => {
    setOpen((was) => {
      if (!was) restoreTo.current = document.activeElement as HTMLElement | null;
      return true;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setStatus("");
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      }
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [show]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(close, 1200);
    return () => clearTimeout(timer);
  }, [status, close]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        event.preventDefault();
        input.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    const back = restoreTo.current;
    return () => {
      document.removeEventListener("keydown", onKey, true);
      back?.focus?.();
    };
  }, [open, close]);

  const q = query.trim();

  const rows = useMemo<Row[]>(() => {
    if (!open) return [];
    const today = toISODate(new Date());
    const names = new Map(projects.map((p) => [p.id, p.name]));
    const out: Row[] = [];
    for (const t of searchTasks(tasks, q, 6)) {
      const project = t.projectId ? names.get(t.projectId) : undefined;
      out.push({
        key: `task-${t.id}`,
        group: "Tasks",
        label: t.title,
        meta: project ?? (t.scheduled ? fmtDate(t.scheduled, today) : undefined),
        icon: "check",
        run: () => openTask(t.id),
      });
    }
    for (const p of searchProjects(projects, q, 4)) {
      out.push({
        key: `project-${p.id}`,
        group: "Projects",
        label: p.name,
        swatch: projectColorVar(p.color),
        run: () => router.push(`/projects/${p.id}`),
      });
    }
    for (const item of NAV) {
      if (q && !matchesQuery(item.label, q)) continue;
      out.push({
        key: `go-${item.key}`,
        group: "Go to",
        label: item.label,
        icon: item.icon ?? "list",
        run: () => router.push(item.href),
      });
    }
    out.push({
      key: "new-task",
      group: "Actions",
      label: "New task",
      icon: "plus",
      run: () => {
        router.push("/");
        focusWhenReady("doem-quick-add");
      },
    });
    if (!q || matchesQuery("Copy today's tasks as a prompt", q) || matchesQuery("claude", q)) {
      out.push({
        key: "copy-today-prompt",
        group: "Actions",
        label: "Copy today's tasks as a prompt",
        icon: "paper",
        stayOpen: true,
        run: async () => {
          let message = "Copied";
          try {
            const now = new Date();
            const todayISO = toISODate(now);
            const layout = layoutToday(tasks, todayISO, now, running?.taskId ?? null, new Set());
            const open = [
              ...(layout.upNext ? [layout.upNext.task] : []),
              ...layout.committed,
              ...layout.couldAlso,
              ...layout.carried,
            ];
            await navigator.clipboard.writeText(todayTasksPrompt({ open, projects, todayISO }));
          } catch {
            message = "Could not copy";
          }
          setStatus(message);
        },
      });
    }
    if (q) {
      out.push({
        key: "see-all",
        group: "Actions",
        label: "See all results",
        icon: "search",
        run: () => router.push(`/search?q=${encodeURIComponent(q)}`),
      });
    }
    return out;
  }, [open, q, tasks, projects, running, openTask, router]);

  if (!open) return null;

  const current = Math.min(active, rows.length - 1);
  const noMatches = q !== "" && !rows.some((r) => r.group !== "Go to" && r.group !== "Actions");

  function run(row: Row | undefined) {
    if (!row) return;
    if (row.stayOpen) {
      void row.run();
      return;
    }
    close();
    void row.run();
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(rows[current]);
    }
  }

  const groups: { name: string; items: { row: Row; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === row.group) last.items.push({ row, index });
    else groups.push({ name: row.group, items: [{ row, index }] });
  });

  const optionId = (index: number) => `${listId}-opt-${index}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[12vh]"
      onClick={close}
    >
      <div className="no-drag absolute inset-x-0 top-0 h-9 w-full" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        className="no-drag relative flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-card bg-surface shadow-md ring-1 ring-line"
      >
        <div className="border-b border-line p-3">
          <div className="composer-frame flex h-11 items-center gap-2.5 rounded-row bg-surface px-3 text-ink-3">
            <Icon name="search" />
            <input
              ref={input}
              type="text"
              role="combobox"
              aria-label="Search tasks, projects and commands"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={rows.length ? optionId(current) : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder="Search tasks, projects and commands"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              className="min-w-0 flex-1 border-0 bg-transparent text-body text-ink placeholder:text-ink-3"
            />
            <Kbd>esc</Kbd>
          </div>
        </div>
        <div id={listId} role="listbox" aria-label="Results" className="overflow-y-auto px-2 pb-2">
          {noMatches && <p className="px-3 pb-1 pt-4 text-body text-ink-3">Nothing matches.</p>}
          {groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <div className={HEADER} aria-hidden="true">
                {group.name}
              </div>
              {group.items.map(({ row, index }) => (
                <div
                  key={row.key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === current}
                  onMouseMove={() => index !== current && setActive(index)}
                  onClick={() => run(row)}
                  className={`flex cursor-pointer items-center gap-3 rounded-row p-3 ${
                    index === current ? "bg-row-hover" : ""
                  }`}
                >
                  <RowIcon row={row} />
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                    {row.label}
                  </span>
                  {row.meta && (
                    <span className="max-w-[40%] shrink-0 truncate text-meta text-ink-3">
                      {row.meta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div role="status" className={status ? "border-t border-line px-5 py-3 text-meta text-ink-3" : "sr-only"}>
          {status}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RowIcon({ row }: { row: Row }): ReactNode {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">
      {row.swatch ? (
        <span className="size-3 rounded-sm" style={{ background: row.swatch }} />
      ) : (
        <Icon name={row.icon ?? "list"} />
      )}
    </span>
  );
}
