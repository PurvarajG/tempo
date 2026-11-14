"use client";

import { useRef } from "react";
import { useTasks } from "@/lib/store-context";
import { WEEKDAY_LABELS, type CalendarDay } from "@/lib/calendar";
import { layoutLanes, minutesToHHMM, plannedBlocks, trackedBlocks, type PlacedBlock } from "@/lib/calendar-blocks";
import { fmtDate, fmtTime, fmtWeekday } from "@/lib/format";
import type { ExternalEvent } from "@/lib/icloud";
import { useNow } from "@/lib/useNow";
import { projectColorVar, type Task } from "@/lib/types";
import Card from "../ui/Card";
import { CAL_PX_PER_HOUR, DAY_WINDOW_HOURS, HourRail, useScrollToHour } from "../time/HourGrid";
import { useDragReschedule } from "./useDragReschedule";

const PX = CAL_PX_PER_HOUR;
const BODY_HEIGHT = DAY_WINDOW_HOURS * PX;
const GRID = "grid grid-cols-[64px_repeat(7,minmax(0,1fr))]";
const SHORT_MINUTES = 42;
const EXTERNAL_DEFAULT_MINUTES = 30;

function minutesOfDay(iso: string, dayISO: string): number {
  const [y, m, d] = dayISO.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d).getTime();
  return Math.round((new Date(iso).getTime() - dayStart) / 60_000);
}

/**
 * The week calendar from soft.html `.calcard`: a head row, an optional
 * all-day strip and one scrolling body with a 64px hour rail and seven
 * flush hairline columns. Planned blocks are solid, tracked blocks striped.
 */
export default function WeekGrid({
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
  const { tasks, projects, openTask, timeEntries, running, settings } = useTasks();
  const now = useNow();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { dragTaskId, overDate, startDrag, endDrag, dragOver, dragLeave, drop } = useDragReschedule(
    tasksByDate,
    onAnnounce,
  );

  // A quarter hour of lead so the first hour label is not cut by the top edge.
  const startHour = settings?.wakingStartHour;
  useScrollToHour(bodyRef, typeof startHour === "number" ? Math.max(0, startHour - 0.25) : null, PX, days[0]?.iso);

  const colourOf = (projectId: string | null | undefined) => {
    const color = projects.find((p) => p.id === projectId)?.color;
    return color ? projectColorVar(color) : "var(--color-ink-3)";
  };
  const cssVar = (projectId: string | null | undefined) => ({ "--c": colourOf(projectId) }) as React.CSSProperties;

  const dropProps = (iso: string) => ({
    onDragOver: (e: React.DragEvent) => dragOver(e, iso),
    onDragLeave: () => dragLeave(iso),
    onDrop: (e: React.DragEvent) => drop(e, iso),
  });

  const hasAllDay = days.some((day) => {
    const untimed = (tasksByDate.get(day.iso) ?? []).some((t) => !t.dueTime);
    const allDayExt = (externalByDate?.get(day.iso) ?? []).some((e) => e.allDay);
    return untimed || allDayExt;
  });

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;

  function renderBlock(day: CalendarDay, b: PlacedBlock) {
    const height = Math.max(18, ((b.endMin - b.startMin) / 60) * PX - 4);
    const short = b.endMin - b.startMin < SHORT_MINUTES;
    const tracked = b.kind === "tracked";
    const classes = ["cal-ev", tracked ? "is-tracked" : "", short ? "is-short" : "", b.done ? "is-done" : ""]
      .filter(Boolean)
      .join(" ");
    const style: React.CSSProperties = {
      ...cssVar(b.projectId),
      top: (b.startMin / 60) * PX + 2,
      height,
      left: `calc(${(b.lane / b.lanes) * 100}% + 4px)`,
      width: `calc(${100 / b.lanes}% - 8px)`,
      right: "auto",
    };
    const content = (
      <>
        <span className="cal-ev-title">{b.title}</span>
        {!short && (
          <span className="cal-ev-time block">
            {fmtTime(minutesToHHMM(b.startMin))} to {b.running ? "now" : fmtTime(minutesToHHMM(b.endMin))}
          </span>
        )}
      </>
    );
    if (tracked) {
      const taskId = b.taskId;
      if (taskId) {
        return (
          <button key={b.key} type="button" title={b.title} className={classes} style={style} onClick={() => openTask(taskId)}>
            {content}
          </button>
        );
      }
      return (
        <div key={b.key} title={b.title} className={classes} style={style}>
          {content}
        </div>
      );
    }
    return (
      <button
        key={b.key}
        type="button"
        draggable
        title={b.title}
        className={`${classes} ${dragTaskId === b.taskId ? "opacity-40" : ""}`}
        style={style}
        onDragStart={(e) => b.taskId && startDrag(e, b.taskId)}
        onDragEnd={endDrag}
        onClick={() => b.taskId && openTask(b.taskId)}
      >
        {content}
      </button>
    );
  }

  return (
    <Card clip className="flex min-h-0 flex-1 flex-col">
      <div className={`${GRID} shrink-0 shadow-[0_1px_0_var(--color-line)]`}>
        <div />
        {days.map((day, i) => {
          const count = (tasksByDate.get(day.iso) ?? []).length;
          const isToday = day.iso === todayISO;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDay(day.iso)}
              aria-label={`${fmtDate(day.iso, todayISO)}, ${count} ${count === 1 ? "task" : "tasks"}`}
              className="flex flex-col items-center px-2 py-3 text-center text-meta text-ink-3 hover:bg-sunk"
              {...dropProps(day.iso)}
            >
              <span className="block">{WEEKDAY_LABELS[i] ?? fmtWeekday(day.iso, "short")}</span>
              <span
                className={
                  isToday
                    ? "mx-auto mt-0.5 block size-8 rounded-full bg-accent text-cal-today text-accent-ink"
                    : "mt-0.5 block text-cal-day text-ink"
                }
              >
                {day.dayOfMonth}
              </span>
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div className={`${GRID} shrink-0 shadow-[0_1px_0_var(--color-line)]`}>
          <div />
          {days.map((day) => {
            const untimed = (tasksByDate.get(day.iso) ?? []).filter((t) => !t.dueTime);
            const allDayExt = (externalByDate?.get(day.iso) ?? []).filter((e) => e.allDay);
            const shownExt = allDayExt.slice(0, 1);
            const more = Math.max(0, untimed.length - 2) + Math.max(0, allDayExt.length - 1);
            return (
              <div key={day.iso} className="min-w-0 space-y-1 p-1" {...dropProps(day.iso)}>
                {untimed.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    title={task.title}
                    className={`cal-ev is-flow is-short ${task.status === "done" ? "is-done" : ""} ${
                      dragTaskId === task.id ? "opacity-40" : ""
                    }`}
                    style={cssVar(task.projectId)}
                    onDragStart={(e) => startDrag(e, task.id)}
                    onDragEnd={endDrag}
                    onClick={() => openTask(task.id)}
                  >
                    <span className="cal-ev-title">{task.title}</span>
                  </button>
                ))}
                {shownExt.map((event) => (
                  <div
                    key={event.id}
                    data-external-event
                    title={`${event.title}, all day, Apple Calendar`}
                    className="cal-ev is-flow is-short is-external"
                  >
                    <span className="cal-ev-title">{event.title}</span>
                  </div>
                ))}
                {more > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day.iso)}
                    className="px-1 text-caption text-ink-3 hover:text-ink"
                  >
                    +{more} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`${GRID} relative`}>
          <HourRail variant="calendar" windowStartHour={0} windowHours={DAY_WINDOW_HOURS} height={BODY_HEIGHT} className="w-16 shrink-0" />
          {days.map((day) => {
            const dayTasks = tasksByDate.get(day.iso) ?? [];
            const blocks = layoutLanes([
              ...plannedBlocks(day.iso, dayTasks),
              ...(now ? trackedBlocks(day.iso, timeEntries, running, tasks, now) : []),
            ]);
            const timedExternal = (externalByDate?.get(day.iso) ?? []).filter((e) => !e.allDay);
            return (
              <div
                key={day.iso}
                role="group"
                aria-label={`${fmtDate(day.iso, todayISO)} hours`}
                className={`cal-col ${day.isWeekend ? "is-weekend" : ""} ${overDate === day.iso ? "is-drop" : ""}`}
                style={{ height: BODY_HEIGHT }}
                {...dropProps(day.iso)}
              >
                {blocks.map((b) => renderBlock(day, b))}
                {timedExternal.map((event) => {
                  const start = Math.max(0, minutesOfDay(event.start, day.iso));
                  const rawEnd = minutesOfDay(event.end, day.iso);
                  const len = rawEnd > start ? Math.min(1440, rawEnd) - start : EXTERNAL_DEFAULT_MINUTES;
                  return (
                    <div
                      key={event.id}
                      data-external-event
                      title={event.title}
                      className="cal-ev is-external is-short"
                      style={{
                        top: (start / 60) * PX + 2,
                        height: Math.max(18, (len / 60) * PX - 4),
                      }}
                    >
                      <span className="cal-ev-title">{event.title}</span>
                    </div>
                  );
                })}
                {day.iso === todayISO && nowMin !== null && (
                  <div className="cal-nowline" style={{ top: (nowMin / 60) * PX }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
