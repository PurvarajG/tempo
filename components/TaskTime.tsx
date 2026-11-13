"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtClock, fmtDate } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import type { Task } from "@/lib/types";
import CategoryDot from "./tracking/CategoryDot";
import Button from "./ui/Button";
import Caption from "./ui/Caption";
import Input from "./ui/Input";

function clockLabel(iso: string): string {
  return fmtClock(new Date(iso));
}

function clock(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * The wall clock is an external store, so that's how it's read: subscribing
 * only while a timer runs, and re-rendering exactly once per second rather
 * than calling Date.now() during render.
 */
export function useElapsed(startedAt: string | undefined): string {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!startedAt) return () => {};
      const id = setInterval(notify, 1000);
      return () => clearInterval(id);
    },
    [startedAt],
  );

  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );

  return startedAt ? clock(startedAt, now) : "";
}

export default function TaskTime({ task }: { task: Task }) {
  const {
    running,
    startTimer,
    stopTimer,
    entriesFor,
    recordedMinutes,
    addManualEntry,
    patchTimeEntry,
    deleteTimeEntry,
    categories,
  } = useTasks();

  const isRunning = running?.taskId === task.id;
  const elapsed = useElapsed(isRunning ? running?.startedAt : undefined);
  const entries = entriesFor(task.id).filter((e) => e.endedAt);
  const recorded = recordedMinutes(task.id);

  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState(toISODate(new Date()));
  const [open, setOpen] = useState(true);

  const collapsible = entries.length > 3;
  const showList = !collapsible || open;

  return (
    <section className="space-y-3" aria-label="Start and tracked time">
      <Caption as="h3">Tracked</Caption>

      <div className="flex items-center gap-3 rounded-row bg-sunk px-4 py-3">
        <Button
          variant="primary"
          icon={isRunning ? undefined : "play"}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
          onClick={() => (isRunning ? stopTimer() : startTimer(task.id))}
        >
          {isRunning ? "Stop" : "Start"}
        </Button>

        {isRunning && (
          <span className="font-mono text-secondary tabular-nums text-ink" aria-live="polite">
            {elapsed}
          </span>
        )}

        <span className="ml-auto text-right font-mono text-meta tabular-nums text-ink-3">
          {fmt(recorded)} of {fmt(task.minutes)}
          <span className="sr-only"> recorded against the estimate</span>
        </span>
      </div>

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {collapsible && (
            <Button
              size="sm"
              iconAfter={open ? "chevup" : "chev"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {entries.length} sessions
            </Button>
          )}
          {showList && (
            <ul className="space-y-1.5">
              {entries.map((entry) => {
                const category = categories.find((c) => c.id === entry.categoryId);
                const day = fmtDate(entry.startedAt.slice(0, 10));
                return (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 text-secondary">
                    {category && (
                      <span
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-meta text-ink-3 inset-ring-1 inset-ring-line-2"
                        title={category.name}
                      >
                        <CategoryDot color={category.color} />
                        {category.name}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-meta text-ink-3">
                      {day} {clockLabel(entry.startedAt)}
                      {entry.endedAt ? ` to ${clockLabel(entry.endedAt)}` : ""}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Minutes recorded on ${day}`}
                      defaultValue={entry.minutes}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (next > 0 && next !== entry.minutes) patchTimeEntry(entry.id, { minutes: next });
                      }}
                      wrapperClassName="h-8 w-20 shrink-0 px-2"
                    />
                    <Input
                      defaultValue={entry.note ?? ""}
                      placeholder="Note"
                      aria-label={`Note for the session on ${day}`}
                      onBlur={(e) => {
                        if (e.target.value !== (entry.note ?? "")) patchTimeEntry(entry.id, { note: e.target.value });
                      }}
                      wrapperClassName="h-8 min-w-0 flex-1 px-2"
                    />
                    <Button
                      size="sm"
                      tone="danger"
                      onClick={() => deleteTimeEntry(entry.id)}
                      aria-label="Delete time entry"
                    >
                      Delete
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {adding ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Caption as="label" htmlFor="manual-date">
              Date
            </Caption>
            <Input
              id="manual-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Caption as="label" htmlFor="manual-minutes">
              Minutes
            </Caption>
            <Input
              id="manual-minutes"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              wrapperClassName="w-24"
            />
          </div>
          <Button
            onClick={async () => {
              const value = Number(minutes);
              if (!(value > 0)) return;
              await addManualEntry({
                taskId: task.id,
                startedAt: new Date(`${date}T09:00`).toISOString(),
                minutes: value,
              });
              setAdding(false);
            }}
          >
            Record
          </Button>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>
          Record time
        </Button>
      )}
    </section>
  );
}
