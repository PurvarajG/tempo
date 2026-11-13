"use client";

import { useTasks } from "@/lib/store-context";
import { WEEKDAY_LABELS, type CalendarDay } from "@/lib/calendar";
import { fmtDate } from "@/lib/format";
import type { ExternalEvent } from "@/lib/icloud";
import { projectColorVar, type Task } from "@/lib/types";
import Card from "@/components/ui/Card";
import { useDragReschedule } from "./useDragReschedule";

const HAIRLINES = "shadow-[-1px_0_0_var(--color-line),0_-1px_0_var(--color-line)]";

/**
 * The month itself, in the week calendar's language: one card, a Monday-first
 * head, hairline cells and project-edged chips. Dragging a chip to another
 * date reschedules it; on touch (and from the keyboard) the same move lives in
 * the day panel as "Move date".
 */
export default function MonthGrid({
  days,
  todayISO,
  tasksByDate,
  externalByDate,
  onSelectDay,
  onAnnounce,
}: {
  days: CalendarDay[];
  todayISO: string;
  tasksByDate: Map<string, Task[]>;
  /** Read-only events imported from Apple Calendar; absent when not configured. */
  externalByDate?: Map<string, ExternalEvent[]>;
  onSelectDay: (iso: string) => void;
  onAnnounce: (message: string) => void;
}) {
  const { projects, openTask } = useTasks();
  const { dragTaskId, overDate, startDrag, endDrag, dragOver, dragLeave, drop } = useDragReschedule(
    tasksByDate,
    onAnnounce,
  );

  const colorOf = (task: Task) => {
    const color = projects.find((p) => p.id === task.projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-ink-3)";
  };

  const rows = Math.max(1, Math.ceil(days.length / 7));
  // Rows share the body's height, so a cell holds a fixed number of chips and
  // the rest is the "+N more" line: 2 chips in a 5-week month, 1 in a 6-week one.
  const cap = rows >= 6 ? 1 : 2;

  return (
    <Card clip className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 shadow-[0_1px_0_var(--color-line)]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-3 text-center text-meta text-ink-3">
            {label}
          </div>
        ))}
      </div>

      <div data-month-body className="min-h-0 flex-1 overflow-hidden">
      <div
        className="grid h-full min-h-[34rem] grid-cols-7 shell:min-h-0"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.iso) ?? [];
          const dayExternal = externalByDate?.get(day.iso) ?? [];
          const isToday = day.iso === todayISO;
          const hidden = Math.max(0, dayTasks.length + dayExternal.length - cap);
          const tint =
            overDate === day.iso ? "bg-accent-soft" : day.isWeekend ? "bg-sunk/50" : "";

          return (
            <div
              key={day.iso}
              data-in-month={day.inMonth ? "true" : "false"}
              onDragOver={(e) => dragOver(e, day.iso)}
              onDragLeave={() => dragLeave(day.iso)}
              onDrop={(e) => drop(e, day.iso)}
              className={`flex min-w-0 flex-col gap-0.5 overflow-hidden p-2 transition-colors ${HAIRLINES} ${tint} ${
                day.inMonth ? "" : "opacity-50"
              }`}
            >
              <button
                onClick={() => onSelectDay(day.iso)}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${fmtDate(day.iso, todayISO)}, ${dayTasks.length} ${
                  dayTasks.length === 1 ? "task" : "tasks"
                }`}
                className="mb-1 flex w-fit items-center rounded-full text-left"
              >
                <span
                  className={`grid h-6 min-w-6 place-items-center rounded-full text-secondary font-medium ${
                    isToday ? "bg-accent text-accent-ink" : day.inMonth ? "text-ink" : "text-ink-3"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
              </button>

              <div className="flex min-h-0 min-w-0 flex-col gap-0.5">
                {dayTasks.slice(0, cap).map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => startDrag(e, task.id)}
                    onDragEnd={endDrag}
                    className={dragTaskId === task.id ? "opacity-40" : ""}
                  >
                    <button
                      onClick={() => openTask(task.id)}
                      title={task.title}
                      style={{ ["--c" as string]: colorOf(task) }}
                      className={`cal-ev is-flow is-short ${task.status === "done" ? "is-done" : ""}`}
                    >
                      <span className="cal-ev-title">{task.title}</span>
                    </button>
                  </div>
                ))}

                {/* Imported events are read-only divs: not draggable, not clickable. */}
                {dayExternal.slice(0, Math.max(0, cap - dayTasks.length)).map((event) => (
                  <div
                    key={event.id}
                    data-external-event
                    title={`${event.title}, Apple Calendar`}
                    style={{ ["--c" as string]: "var(--color-ink-3)" }}
                    className="cal-ev is-flow is-short is-external"
                  >
                    <span className="cal-ev-title">{event.title}</span>
                  </div>
                ))}

                {hidden > 0 && (
                  <button
                    onClick={() => onSelectDay(day.iso)}
                    className="w-fit shrink-0 px-1 text-meta text-ink-3 hover:text-ink"
                  >
                    +{hidden} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
