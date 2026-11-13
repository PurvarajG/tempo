"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/ui/Icon";
import { fmtDate, fmtDay } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { daysBetween } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import { DAY_END_HOUR, projectColorVar, type Project, type Task, type TaskInput } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import {
  resolveTimelineDrag,
  useTimelineDrag,
  type TimelineDragHandlers,
  type TimelineDragMode,
  type TimelinePreview,
} from "@/lib/useTimelineDrag";

type Span = 1 | 2 | 3 | 5 | 7 | 10 | 14;

const DEFAULT_START_HOUR = 8;
const FALLBACK_COLOR = "var(--color-ink-3)";
const BAR_INK: CSSProperties = { color: "var(--color-project-foreground)" };

function minutesAt(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function rangeLabel(days: string[], todayISO: string) {
  return days.length === 1
    ? fmtDate(days[0], todayISO)
    : `${fmtDay(days[0])} to ${fmtDay(days.at(-1)!)}`;
}

/** A task that has a date; undated (inbox) tasks never appear on the timeline. */
type DatedTask = Task & { scheduled: string };

function projectFor(task: Task, projects: Project[]) {
  return projects.find((project) => project.id === task.projectId);
}

function colorFor(task: Task, projects: Project[]) {
  const project = projectFor(task, projects);
  return project?.color ? projectColorVar(project.color) : FALLBACK_COLOR;
}

/** A complex task is visible whenever its range overlaps the visible days at all. */
function overlapsRange(task: Task, days: string[]): task is DatedTask {
  if (task.scheduled === null) return false;
  if (task.isComplex && task.finishDate) {
    return task.scheduled <= days.at(-1)! && task.finishDate >= days[0];
  }
  return days.includes(task.scheduled);
}

const NAV_BUTTON =
  "grid size-7 place-items-center rounded-tile text-ink-3 transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink";

/** The Today Day tab: an hour grid for short spans, project lanes by day for long ones. */
export default function DashboardTimeline({ todayISO, span = 1 }: { todayISO: string; span?: Span }) {
  const { tasks, projects, settings, openTask, patchTask } = useTasks();
  const now = useNow();
  const [announcement, setAnnouncement] = useState("");
  const [startISO, setStartISO] = useState(todayISO);
  const days = Array.from({ length: span }, (_, index) => shiftDays(startISO, index));
  const visibleTasks = tasks.filter(
    (task): task is DatedTask => task.status !== "trashed" && overlapsRange(task, days),
  );
  const startHour = settings?.wakingStartHour ?? DEFAULT_START_HOUR;
  const rawEnd = settings?.wakingEndHour ?? DAY_END_HOUR;
  const endHour = rawEnd > startHour ? rawEnd : DAY_END_HOUR;
  const unit = span === 1 ? "day" : `${span} days`;

  return (
    <section data-testid="today-timeline" aria-label="Task timeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-caption text-ink-3">{rangeLabel(days, todayISO)}</p>
        <div className="flex items-center gap-1">
          {startISO !== todayISO && (
            <button
              type="button"
              onClick={() => setStartISO(todayISO)}
              className="rounded-tile px-2 py-1 text-meta font-medium text-accent transition-colors duration-150 ease-out hover:bg-accent-soft"
            >
              Today
            </button>
          )}
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => setStartISO((current) => shiftDays(current, -span))} className={NAV_BUTTON}>
            <Icon name="chev" size={14} className="rotate-180" />
          </button>
          <button type="button" aria-label={`Next ${unit}`} onClick={() => setStartISO((current) => shiftDays(current, span))} className={NAV_BUTTON}>
            <Icon name="chev" size={14} />
          </button>
        </div>
      </div>

      {span <= 3 ? (
        <HourTimeline days={days} tasks={visibleTasks} projects={projects} todayISO={todayISO} now={now} startHour={startHour} endHour={endHour} onOpenTask={openTask} />
      ) : (
        <DayTimeline
          days={days}
          tasks={visibleTasks}
          projects={projects}
          todayISO={todayISO}
          onOpenTask={openTask}
          onPatchTask={patchTask}
          onAnnounce={setAnnouncement}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

function HourTimeline({ days, tasks, projects, todayISO, now, startHour, endHour, onOpenTask }: { days: string[]; tasks: DatedTask[]; projects: Project[]; todayISO: string; now: Date | null; startHour: number; endHour: number; onOpenTask: (id: string) => void }) {
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  return (
    <div className="mt-4 overflow-x-auto pb-2" data-testid="hour-scale-timeline">
      <div className="min-w-[56rem] overflow-hidden rounded-card ring-1 ring-line">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] border-b border-line bg-sunk">
          <div className="px-3 py-2 font-mono text-caption uppercase text-ink-3">Day</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
            {hours.map((hour) => (
              <div key={hour} className="border-l border-line px-1 py-2 font-mono text-caption text-ink-3">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>
        {days.map((iso) => (
          <HourLane key={iso} iso={iso} tasks={tasks.filter((task) => task.scheduled === iso)} projects={projects} todayISO={todayISO} now={now} startHour={startHour} endHour={endHour} onOpenTask={onOpenTask} />
        ))}
      </div>
    </div>
  );
}

/** Greedy interval colouring: each task takes the lowest column free at its start. */
function assignColumns(tasks: DatedTask[]): { task: DatedTask; column: number; columns: number }[] {
  const sorted = [...tasks].sort((a, b) => {
    const startDiff = minutesAt(a.dueTime!) - minutesAt(b.dueTime!);
    if (startDiff !== 0) return startDiff;
    const endDiff = minutesAt(a.dueTime!) + a.minutes - (minutesAt(b.dueTime!) + b.minutes);
    if (endDiff !== 0) return endDiff;
    return a.id.localeCompare(b.id);
  });

  const result: { task: DatedTask; column: number; columns: number }[] = [];
  const columnEnds: number[] = [];
  let cluster: { task: DatedTask; column: number }[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columns = Math.max(...cluster.map((entry) => entry.column)) + 1;
    for (const entry of cluster) result.push({ ...entry, columns });
    cluster = [];
  };

  for (const task of sorted) {
    const start = minutesAt(task.dueTime!);
    const end = start + task.minutes;

    if (start >= clusterEnd) {
      flushCluster();
      columnEnds.length = 0;
      clusterEnd = -Infinity;
    }

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }

    cluster.push({ task, column });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flushCluster();

  return result;
}

function HourLane({ iso, tasks, projects, todayISO, now, startHour, endHour, onOpenTask }: { iso: string; tasks: DatedTask[]; projects: Project[]; todayISO: string; now: Date | null; startHour: number; endHour: number; onOpenTask: (id: string) => void }) {
  const dayMinutes = (endHour - startHour) * 60;
  const hourPct = 100 / (endHour - startHour);
  const isToday = iso === todayISO;
  const timed = tasks.filter((task) => task.dueTime);
  const unscheduled = tasks.filter((task) => !task.dueTime);
  const currentMinutes = now && isToday ? now.getHours() * 60 + now.getMinutes() : null;
  const currentLeft = currentMinutes === null ? null : ((currentMinutes - startHour * 60) / dayMinutes) * 100;
  const columned = assignColumns(timed);
  const maxColumns = columned.reduce((max, entry) => Math.max(max, entry.columns), 1);
  // A sparse day keeps a tall track (112px) and each stacked task lane gets 34px.
  const trackHeight = Math.max(112, maxColumns * 34 + 16);
  const gridline = `repeating-linear-gradient(to right, transparent 0, transparent calc(${hourPct}% - 1px), var(--color-line) calc(${hourPct}% - 1px), var(--color-line) ${hourPct}%)`;
  return (
    <div className={`grid grid-cols-[6rem_minmax(0,1fr)] border-b border-line last:border-b-0 ${isToday ? "bg-accent-soft" : ""}`}>
      <Link href={`/calendar?date=${iso}`} aria-label={`Open calendar for ${fmtDate(iso, todayISO)}`} className="border-r border-line px-3 py-3 transition-colors duration-150 ease-out hover:bg-sunk">
        <span className={`block font-mono text-meta ${isToday ? "font-semibold text-accent" : "text-ink-3"}`}>{fmtDate(iso, todayISO)}</span>
        {isToday && <span className="font-mono text-caption uppercase text-accent">Today</span>}
      </Link>
      <div>
        <div className="relative" style={{ height: trackHeight, backgroundImage: gridline }}>
          {columned.map(({ task, column }) => (
            <TimeBar key={task.id} task={task} column={column} color={colorFor(task, projects)} startHour={startHour} dayMinutes={dayMinutes} onOpenTask={onOpenTask} />
          ))}
          {currentLeft !== null && currentLeft >= 0 && currentLeft <= 100 && (
            <div aria-label="Current time" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-accent" style={{ left: `${currentLeft}%` }} />
          )}
        </div>
        {unscheduled.length > 0 && (
          <div aria-label={`Unscheduled tasks for ${fmtDate(iso, todayISO)}`} className="flex flex-wrap gap-1 border-t border-line px-2 py-2">
            {unscheduled.map((task) => (
              <TaskButton key={task.id} task={task} color={colorFor(task, projects)} onOpenTask={onOpenTask} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeBar({ task, color, column, startHour, dayMinutes, onOpenTask }: { task: DatedTask; color: string; column: number; startHour: number; dayMinutes: number; onOpenTask: (id: string) => void }) {
  const start = minutesAt(task.dueTime!);
  const left = Math.max(0, ((start - startHour * 60) / dayMinutes) * 100);
  const right = Math.min(100, ((start + task.minutes - startHour * 60) / dayMinutes) * 100);
  if (right <= 0 || left >= 100) return null;
  return (
    <button
      type="button"
      data-testid="timeline-bar"
      onClick={() => onOpenTask(task.id)}
      title={task.title}
      className={`absolute px-2 text-left ${barChrome(task.status === "done")}`}
      style={{ left: `${left}%`, width: `${Math.max(right - left, 2)}%`, top: 8 + column * 34, height: 28, backgroundColor: color, ...BAR_INK }}
    >
      <span className="block truncate">{task.title}</span>
    </button>
  );
}

/**
 * A task's rendered range: the real scheduled/finishDate, or the live drag preview when it's
 * the one being dragged. This never changes which bucket (day cell vs. spanning overlay) a bar
 * lives in — only `resolveTimelineDrag`'s *committed* patch does that, after the gesture ends.
 * Re-bucketing mid-gesture would unmount the very DOM node holding pointer capture.
 */
function effectiveRange(
  task: DatedTask,
  preview: TimelinePreview | null,
  days: string[],
): { scheduled: string; finishDate?: string } {
  if (!preview || preview.taskId !== task.id) {
    return { scheduled: task.scheduled, finishDate: task.isComplex ? task.finishDate : undefined };
  }
  const targetISO = days[preview.dayIndex];
  const { preview: next } = resolveTimelineDrag(
    preview.mode,
    { scheduled: task.scheduled, isComplex: task.isComplex, finishDate: task.finishDate },
    targetISO,
  );
  return next;
}

type TimelineDragPatchLike = { scheduled?: string | null; finishDate?: string; isComplex?: boolean };

function describeDrag(mode: TimelineDragMode, title: string, patch: TimelineDragPatchLike, todayISO: string): string {
  if (patch.isComplex === false) return `${title} is a single day task again.`;
  if (mode === "resize-end" && patch.finishDate) return `${title} now finishes ${fmtDate(patch.finishDate, todayISO)}.`;
  if (mode === "resize-start" && patch.scheduled) return `${title} now starts ${fmtDate(patch.scheduled, todayISO)}.`;
  return patch.scheduled ? `${title} moved to ${fmtDate(patch.scheduled, todayISO)}.` : `${title} moved.`;
}

function DayTimeline({
  days,
  tasks,
  projects,
  todayISO,
  onOpenTask,
  onPatchTask,
  onAnnounce,
}: {
  days: string[];
  tasks: DatedTask[];
  projects: Project[];
  todayISO: string;
  onOpenTask: (id: string) => void;
  onPatchTask: (id: string, patch: Partial<TaskInput>) => void;
  onAnnounce: (message: string) => void;
}) {
  const known = new Set(projects.map((p) => p.id));
  const isOrphan = (task: DatedTask) => !task.projectId || !known.has(task.projectId);
  const lanes = [
    ...projects
      .filter((project) => tasks.some((task) => task.projectId === project.id))
      .map((project) => ({ ...project, color: projectColorVar(project.color) })),
    ...(tasks.some((task) => isOrphan(task)) ? [{ id: "unassigned", name: "Unassigned", color: FALLBACK_COLOR }] : []),
  ];
  const gridRef = useRef<HTMLDivElement>(null);

  const handleCommit = useCallback(
    (drag: { taskId: string; mode: TimelineDragMode }, dayIndex: number) => {
      const task = tasks.find((t) => t.id === drag.taskId);
      if (!task) return;
      const targetISO = days[dayIndex];
      const { patch } = resolveTimelineDrag(
        drag.mode,
        { scheduled: task.scheduled, isComplex: task.isComplex, finishDate: task.finishDate },
        targetISO,
      );
      if (!patch) return;
      onPatchTask(task.id, patch);
      onAnnounce(describeDrag(drag.mode, task.title, patch, todayISO));
    },
    [tasks, days, todayISO, onPatchTask, onAnnounce],
  );

  const { preview, bind, wrapClick } = useTimelineDrag({ days, gridRef, onCommit: handleCommit });

  return (
    <div className="mt-4 overflow-x-auto pb-2" data-testid="day-scale-timeline">
      <div className="min-w-[48rem] overflow-hidden rounded-card ring-1 ring-line">
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-line bg-sunk">
          <div className="px-3 py-2 font-mono text-caption uppercase text-ink-3">Project</div>
          <div ref={gridRef} data-testid="timeline-day-grid" className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(5rem, 1fr))` }}>
            {days.map((iso) => <DayHeader key={iso} iso={iso} todayISO={todayISO} />)}
          </div>
        </div>
        {lanes.map((lane) => {
          const laneOf = (task: DatedTask) => (lane.id === "unassigned" ? isOrphan(task) : task.projectId === lane.id);
          // Bucketed by the task's REAL isComplex/scheduled, never by the live preview, so the
          // dragged bar's DOM node never moves to a different parent mid-gesture (that would
          // unmount it and drop pointer capture). Only its on-screen position/size follows the preview.
          const laneTasks = tasks.filter(laneOf);
          const spanning = laneTasks.filter((task) => task.isComplex && task.finishDate);
          const barsHeight = spanning.length > 0 ? 4 + spanning.length * 24 : 0;
          return (
            <div key={lane.id} className="grid min-h-20 grid-cols-[8rem_minmax(0,1fr)] border-b border-line last:border-b-0">
              <div className="flex items-center gap-2 border-r border-line px-3 text-meta text-ink-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: lane.color }} />
                <span className="truncate">{lane.name}</span>
              </div>
              <div className="relative">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(5rem, 1fr))` }}>
                  {days.map((iso) => (
                    <div
                      key={iso}
                      className={`border-l border-line p-1 ${iso === todayISO ? "bg-accent-soft" : ""}`}
                      style={barsHeight > 0 ? { paddingTop: barsHeight } : undefined}
                    >
                      {laneTasks
                        .filter((task) => !task.isComplex && task.scheduled === iso)
                        .map((task) => (
                          <TaskButton
                            key={task.id}
                            task={task}
                            color={lane.color}
                            fill
                            onOpenTask={onOpenTask}
                            bind={bind}
                            wrapClick={wrapClick}
                            preview={preview?.taskId === task.id ? effectiveRange(task, preview, days) : null}
                          />
                        ))}
                    </div>
                  ))}
                </div>
                {spanning.map((task, index) => (
                  <SpanBar
                    key={task.id}
                    task={task}
                    view={effectiveRange(task, preview, days)}
                    days={days}
                    color={lane.color}
                    top={4 + index * 24}
                    onOpenTask={onOpenTask}
                    bind={bind}
                    wrapClick={wrapClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const barChrome = (done: boolean) =>
  `truncate rounded-check text-caption font-medium shadow-sm transition-opacity duration-150 ease-out hover:opacity-85 ${done ? "opacity-55 line-through" : ""}`;

/** The two grab handles shared by `SpanBar` and day-scale `TaskButton`, inset at the bar's edges. */
function TimelineHandles({ taskId, bind }: { taskId: string; bind: (taskId: string, mode: TimelineDragMode) => TimelineDragHandlers }) {
  const start = bind(taskId, "resize-start");
  const end = bind(taskId, "resize-end");
  return (
    <>
      <span
        aria-hidden="true"
        onPointerDown={start.onPointerDown}
        onPointerMove={start.onPointerMove}
        onPointerUp={start.onPointerUp}
        onPointerCancel={start.onPointerCancel}
        style={start.style}
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize opacity-0 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100"
      />
      <span
        aria-hidden="true"
        onPointerDown={end.onPointerDown}
        onPointerMove={end.onPointerMove}
        onPointerUp={end.onPointerUp}
        onPointerCancel={end.onPointerCancel}
        style={end.style}
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-ew-resize opacity-0 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100"
      />
    </>
  );
}

/** A complex task's continuous bar across the day-columns it spans, clamped to the visible window. */
function SpanBar({
  task,
  view,
  days,
  color,
  top,
  onOpenTask,
  bind,
  wrapClick,
}: {
  task: DatedTask;
  view: { scheduled: string; finishDate?: string };
  days: string[];
  color: string;
  top: number;
  onOpenTask: (id: string) => void;
  bind: (taskId: string, mode: TimelineDragMode) => TimelineDragHandlers;
  wrapClick: (onClick: () => void) => () => void;
}) {
  const span = days.length;
  const startOffset = Math.max(0, daysBetween(days[0], view.scheduled));
  const endOffset = Math.min(span, daysBetween(days[0], view.finishDate ?? view.scheduled) + 1);
  if (endOffset <= startOffset) return null;
  const left = (startOffset / span) * 100;
  const width = ((endOffset - startOffset) / span) * 100;
  const move = bind(task.id, "move");
  const start = bind(task.id, "resize-start");
  const end = bind(task.id, "resize-end");
  // Handles are siblings of the bar (not nested inside it): a handle's pointerdown would
  // otherwise bubble up into the bar's own "move" pointerdown and stomp its drag mode.
  return (
    <>
      <button
        type="button"
        data-testid="timeline-bar"
        onClick={wrapClick(() => onOpenTask(task.id))}
        onPointerDown={move.onPointerDown}
        onPointerMove={move.onPointerMove}
        onPointerUp={move.onPointerUp}
        onPointerCancel={move.onPointerCancel}
        title={task.title}
        className={`absolute cursor-grab px-2 text-left ${barChrome(task.status === "done")}`}
        style={{ left: `${left}%`, width: `${width}%`, top, height: 20, backgroundColor: color, ...BAR_INK, ...move.style }}
      >
        {task.title}
      </button>
      <span
        aria-hidden="true"
        onPointerDown={start.onPointerDown}
        onPointerMove={start.onPointerMove}
        onPointerUp={start.onPointerUp}
        onPointerCancel={start.onPointerCancel}
        style={{ left: `${left}%`, top, height: 20, ...start.style }}
        className="absolute z-10 w-1.5 -translate-x-1/2 cursor-ew-resize opacity-0 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100"
      />
      <span
        aria-hidden="true"
        onPointerDown={end.onPointerDown}
        onPointerMove={end.onPointerMove}
        onPointerUp={end.onPointerUp}
        onPointerCancel={end.onPointerCancel}
        style={{ left: `${left + width}%`, top, height: 20, ...end.style }}
        className="absolute z-10 w-1.5 -translate-x-1/2 cursor-ew-resize opacity-0 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100"
      />
    </>
  );
}

function DayHeader({ iso, todayISO }: { iso: string; todayISO: string }) {
  const isToday = iso === todayISO;
  return (
    <Link
      href={`/calendar?date=${iso}`}
      aria-label={`Open calendar for ${fmtDate(iso, todayISO)}`}
      className={`border-l border-line px-2 py-2 font-mono text-caption transition-colors duration-150 ease-out hover:bg-surface ${isToday ? "bg-accent-soft text-accent" : "text-ink-3"}`}
    >
      {fmtDate(iso, todayISO)}
    </Link>
  );
}

function TaskButton({
  task,
  color,
  fill,
  onOpenTask,
  bind,
  wrapClick,
  preview,
}: {
  task: DatedTask;
  color: string;
  fill?: boolean;
  onOpenTask: (id: string) => void;
  bind?: (taskId: string, mode: TimelineDragMode) => TimelineDragHandlers;
  wrapClick?: (onClick: () => void) => () => void;
  /** Live drag preview for THIS task, expressed in real dates, never changes which cell it renders in. */
  preview?: { scheduled: string; finishDate?: string } | null;
}) {
  if (!bind || !wrapClick) {
    return (
      <button
        type="button"
        data-testid="timeline-bar"
        onClick={() => onOpenTask(task.id)}
        title={task.title}
        className={`${fill ? "block w-full" : "inline-block max-w-[12rem]"} px-2 py-1 ${barChrome(task.status === "done")}`}
        style={{ backgroundColor: color, ...BAR_INK }}
      >
        {task.title}
      </button>
    );
  }
  const move = bind(task.id, "move");
  // A day cell is exactly one day-column wide, so the preview offset/width can be expressed as
  // whole multiples of the cell's own box: a translate for a relocation, or a wider box (with a
  // stacking context so it visually overlaps neighbouring cells) for a grow-into-span preview.
  let previewStyle: CSSProperties | undefined;
  if (preview) {
    if (preview.finishDate) {
      const widthDays = daysBetween(task.scheduled, preview.finishDate) + 1;
      previewStyle = { zIndex: 20, width: `${widthDays * 100}%` };
    } else {
      const offsetDays = daysBetween(task.scheduled, preview.scheduled);
      if (offsetDays !== 0) previewStyle = { zIndex: 20, transform: `translateX(${offsetDays * 100}%)` };
    }
  }
  return (
    <div className={`relative ${fill ? "block w-full" : "inline-block max-w-[12rem]"}`} style={previewStyle}>
      <button
        type="button"
        data-testid="timeline-bar"
        onClick={wrapClick(() => onOpenTask(task.id))}
        onPointerDown={move.onPointerDown}
        onPointerMove={move.onPointerMove}
        onPointerUp={move.onPointerUp}
        onPointerCancel={move.onPointerCancel}
        title={task.title}
        className={`block w-full cursor-grab px-2 py-1 ${barChrome(task.status === "done")}`}
        style={{ backgroundColor: color, ...BAR_INK, ...move.style }}
      >
        {task.title}
      </button>
      <TimelineHandles taskId={task.id} bind={bind} />
    </div>
  );
}
