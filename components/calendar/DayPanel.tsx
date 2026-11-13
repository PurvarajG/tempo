"use client";

import { useId, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { externalEventLabel } from "@/lib/external-events-view";
import { fmtDate } from "@/lib/format";
import type { ExternalEvent } from "@/lib/icloud";
import { toISODate } from "@/lib/parse";
import type { Task } from "@/lib/types";
import { hasTextSelection } from "@/lib/selection";
import { TaskMeta } from "../TaskRow";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import SidePanel from "../ui/SidePanel";

/**
 * The day's work, plus the two things you'd want from a date you just clicked:
 * add something to it, or move something off it. The Move date control is the
 * accessible equivalent of dragging a marker across the grid, and it's the
 * only way on touch.
 *
 * The interior content is split into `DayPanelBody` so the Day calendar view
 * can embed the exact same add/list/move-date affordances inline in its side
 * rail instead of only reaching them through this click-to-open modal — one
 * implementation of "a day's tasks, with add and move" either way.
 */
export function DayPanelBody({
  iso,
  tasks,
  externalEvents = [],
}: {
  iso: string;
  tasks: Task[];
  /** Read-only, from Apple Calendar. Never editable from this app. */
  externalEvents?: ExternalEvent[];
}) {
  const { addTask, openTask, patchTask } = useTasks();
  const [draft, setDraft] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  // Unique per mounted instance so the rail's inline copy (app/calendar/page.tsx)
  // and this modal can never collide on id/htmlFor even if both are ever
  // mounted at once — see the calendar page for why that's now suppressed.
  const inputId = useId();

  const todayISO = toISODate(new Date());

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="composer-frame flex h-13 items-center gap-3 rounded-composer bg-surface pl-4 pr-3"
      >
        <Icon name="plus" size={18} className="text-ink-3" />
        <label htmlFor={inputId} className="sr-only">
          Add a task on this day
        </label>
        <input
          id={inputId}
          data-day-add-input
          value={draft}
          placeholder="What needs doing?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!draft.trim()) return;
            const text = draft;
            setDraft("");
            // The date comes from the day you opened, not from parsing.
            await addTask(text, { scheduled: iso }).catch(() => {});
          }}
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3"
        />
      </form>

      {tasks.length === 0 ? (
        <p className="text-secondary text-ink-3">Nothing scheduled. Add the first thing above.</p>
      ) : (
        <ul>
          {tasks.map((task) => {
            const done = task.status === "done";
            return (
              <li
                key={task.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-row border-t border-line px-3 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasTextSelection()) return;
                      openTask(task.id);
                    }}
                    className={`select-text block w-full min-w-0 truncate text-left text-body font-medium hover:text-accent ${
                      done ? "text-ink-3 line-through" : "text-ink"
                    }`}
                  >
                    {task.title}
                  </button>
                  <TaskMeta task={task} todayISO={todayISO} showEstimate hidePriority={done} />
                </div>

                {moving === task.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      autoFocus
                      aria-label={`New date for ${task.title}`}
                      defaultValue={task.scheduled ?? undefined}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        // The time of day is deliberately preserved.
                        patchTask(task.id, { scheduled: e.target.value });
                        setMoving(null);
                      }}
                      className="h-[30px] rounded-full bg-surface px-3 text-meta text-ink inset-ring-1 inset-ring-line-2"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setMoving(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMoving(task.id)}
                    aria-label={`Move date for ${task.title}`}
                  >
                    Move date
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {externalEvents.length > 0 && (
        <section>
          <h3 className="px-3 pb-1 text-meta font-normal text-ink-3">From Apple Calendar</h3>
          {/* No buttons, no inputs: nothing in this app can change these. */}
          <ul>
            {externalEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 border-t border-dashed border-line px-3 py-2 text-body text-ink-3 first:border-t-0"
              >
                <span className="min-w-0 truncate">{event.title}</span>
                <span className="shrink-0 font-mono text-meta">{externalEventLabel(event)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function DayPanel({
  iso,
  tasks,
  externalEvents = [],
  onClose,
}: {
  iso: string;
  tasks: Task[];
  /** Read-only, from Apple Calendar. Never editable from this app. */
  externalEvents?: ExternalEvent[];
  onClose: () => void;
}) {
  return (
    <SidePanel open onClose={onClose} title={fmtDate(iso)}>
      <DayPanelBody iso={iso} tasks={tasks} externalEvents={externalEvents} />
    </SidePanel>
  );
}
