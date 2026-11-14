"use client";

import { useRef } from "react";
import { useTasks } from "@/lib/store-context";
import type { CalendarDay } from "@/lib/calendar";
import { layoutLanes, minutesToHHMM, plannedBlocks, trackedBlocks } from "@/lib/calendar-blocks";
import { fmtDate, fmtTime, fmtWeekday } from "@/lib/format";
import type { ExternalEvent } from "@/lib/icloud";
import { useNow } from "@/lib/useNow";
import { projectColorVar, type Task } from "@/lib/types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { CAL_PX_PER_HOUR, dayHeight, HourRail, instantToPx, useScrollToHour } from "../time/HourGrid";

const PX = CAL_PX_PER_HOUR;
const HEIGHT = dayHeight(PX);
const SHORT_MIN = 42;

function externalTime(event: ExternalEvent): string {
  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const from = fmtTime(hhmm(event.start));
  return event.start === event.end ? from : `${from} to ${fmtTime(hhmm(event.end))}`;
}

/**
 * One column of the week calendar (soft.html .calcard): same card, head cell,
 * hour rail and blocks. NOT draggable: this view shows one day, so there is no
 * second date to drop on. Rescheduling stays on the day panel's "Move date".
 */
export default function DayGrid({
  day,
  todayISO,
  tasksByDate,
  externalByDate,
  onSelectDay,
}: {
  day: CalendarDay;
  todayISO: string;
  tasksByDate: Map<string, Task[]>;
  externalByDate?: Map<string, ExternalEvent[]>;
  onSelectDay: (iso: string) => void;
}) {
  const { tasks, projects, openTask, timeEntries, running, settings } = useTasks();
  const now = useNow();
  const bodyRef = useRef<HTMLDivElement>(null);
  // A quarter hour of lead so the first hour label is not cut by the top edge.
  const startHour = settings?.wakingStartHour;
  useScrollToHour(bodyRef, typeof startHour === "number" ? Math.max(0, startHour - 0.25) : null, PX, day.iso);

  const colorOf = (projectId: string | null | undefined) => {
    const color = projects.find((p) => p.id === projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-ink-3)";
  };

  const isToday = day.iso === todayISO;
  const nowOffset = isToday && now ? instantToPx(now.toISOString(), PX) : null;

  const dayTasks = tasksByDate.get(day.iso) ?? [];
  const untimed = dayTasks.filter((t) => !t.dueTime);
  const dayExternal = externalByDate?.get(day.iso) ?? [];
  const timedExternal = dayExternal.filter((e) => !e.allDay);
  const allDayExternal = dayExternal.filter((e) => e.allDay);

  const blocks = layoutLanes([
    ...plannedBlocks(day.iso, dayTasks),
    ...trackedBlocks(day.iso, timeEntries, running, tasks, now ?? new Date()),
  ]);

  const addOnThisDay = () => {
    // The Day view's side rail already renders this day's add-task input;
    // focus it rather than opening a second copy in a modal.
    const input = document.querySelector<HTMLInputElement>("[data-day-add-input]");
    if (input) input.focus();
    else onSelectDay(day.iso);
  };

  return (
    <Card clip className="flex min-h-0 flex-1 flex-col">
      <div className="relative grid shrink-0 grid-cols-[64px_1fr] shadow-[0_1px_0_var(--color-line)]">
        <div />
        <div className="px-2 py-3 text-center text-meta text-ink-3">
          {fmtWeekday(day.iso, "short")}
          <b
            className={
              isToday
                ? "mx-auto mt-0.5 block size-8 rounded-full bg-accent text-title leading-8 text-accent-ink"
                : "mt-0.5 block text-upnext text-ink"
            }
          >
            {day.dayOfMonth}
          </b>
        </div>
        <div className="absolute inset-y-0 right-3 flex items-center">
          <Button variant="ghost" size="sm" icon="plus" onClick={addOnThisDay}>
            Add a task on this day
          </Button>
        </div>
      </div>

      {(untimed.length > 0 || allDayExternal.length > 0) && (
        <div className="grid shrink-0 grid-cols-[64px_1fr] shadow-[0_1px_0_var(--color-line)]">
          <div />
          <div className="flex max-h-28 flex-wrap content-start gap-1 overflow-y-auto p-1">
            {untimed.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => openTask(task.id)}
                aria-label={task.title}
                title={task.title}
                className={`cal-ev is-flow is-short w-auto! max-w-full! ${task.status === "done" ? "is-done" : ""}`}
                style={{ "--c": colorOf(task.projectId) } as React.CSSProperties}
              >
                <span className="cal-ev-title">{task.title}</span>
              </button>
            ))}
            {allDayExternal.map((event) => (
              <div
                key={event.id}
                data-external-event
                title={`${event.title}, all day (Apple Calendar)`}
                className="cal-ev is-flow is-short is-external w-auto! max-w-full!"
              >
                <span className="cal-ev-title">{event.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative grid grid-cols-[64px_1fr]">
          <HourRail variant="calendar" windowStartHour={0} windowHours={24} height={HEIGHT} className="w-16 shrink-0" />
          <div
            role="group"
            aria-label={`${fmtDate(day.iso, todayISO)} hours`}
            className={`cal-col ${day.isWeekend ? "is-weekend" : ""}`}
            style={{ height: HEIGHT }}
          >
            {blocks.map((b) => {
              const top = (b.startMin / 60) * PX + 2;
              const height = Math.max(18, ((b.endMin - b.startMin) / 60) * PX - 4);
              const short = b.endMin - b.startMin < SHORT_MIN;
              const time = `${fmtTime(minutesToHHMM(b.startMin))} to ${
                b.running ? "now" : fmtTime(minutesToHHMM(b.endMin))
              }`;
              const cls = [
                "cal-ev",
                b.kind === "tracked" ? "is-tracked" : "",
                short ? "is-short" : "",
                b.done ? "is-done" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => b.taskId && openTask(b.taskId)}
                  aria-label={b.kind === "tracked" ? `${b.title}, tracked ${time}` : b.title}
                  title={b.title}
                  className={cls}
                  style={
                    {
                      "--c": colorOf(b.projectId),
                      top,
                      height,
                      left: `calc(${b.lane} / ${b.lanes} * 100% + 4px)`,
                      width: `calc(100% / ${b.lanes} - 8px)`,
                      right: "auto",
                    } as React.CSSProperties
                  }
                >
                  <span className="cal-ev-title">{b.title}</span>
                  {!short && <span className="cal-ev-time">{time}</span>}
                </button>
              );
            })}

            {timedExternal.map((event) => (
              <div
                key={event.id}
                data-external-event
                title={`${event.title}, ${externalTime(event)} (Apple Calendar)`}
                className="cal-ev is-external is-short"
                style={{ top: instantToPx(event.start, PX) + 2 }}
              >
                <span className="cal-ev-title">{event.title}</span>
              </div>
            ))}

            {nowOffset !== null && <div aria-label="Now" className="cal-nowline" style={{ top: nowOffset }} />}
          </div>
        </div>
      </div>
    </Card>
  );
}
