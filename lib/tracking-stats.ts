import { addDays, daysBetween, toISODate } from "./parse";
import { wakingWindow } from "./tracking-day";
import { weekDays } from "./today";
import type { Category, CategoryKind, Project, Segment, Task, TrackingSettings } from "./types";

function minutesBetween(fromISO: string, toISO: string): number {
  return (new Date(toISO).getTime() - new Date(fromISO).getTime()) / 60_000;
}

/**
 * Tracked minutes ÷ waking minutes elapsed so far. For a past day the whole
 * waking window has elapsed; for today, only up to now; a future day hasn't
 * started yet.
 */
export function coveragePercent(
  segments: Segment[],
  dayISO: string,
  todayISO: string,
  settings: TrackingSettings,
  now: Date,
): number {
  const { start: wakeStart, end: wakeEnd } = wakingWindow(dayISO, settings);
  const elapsedEnd = dayISO < todayISO ? wakeEnd : dayISO > todayISO ? wakeStart : now < wakeEnd ? now : wakeEnd;
  const elapsedMinutes = Math.max(0, (elapsedEnd.getTime() - wakeStart.getTime()) / 60_000);
  if (elapsedMinutes === 0) return 0;

  const tracked = segments.reduce((sum, s) => sum + minutesBetween(s.startedAt, s.endedAt ?? now.toISOString()), 0);
  return Math.min(100, Math.round((tracked / elapsedMinutes) * 100));
}

/** The longest single continuous segment, not a chain of same-category ones. */
export function longestStretchMinutes(segments: Segment[], now: Date): number {
  return Math.round(
    segments.reduce((max, s) => Math.max(max, minutesBetween(s.startedAt, s.endedAt ?? now.toISOString())), 0),
  );
}

/** The hour with the most segment starts — a rough proxy for context-switching. */
export function mostFragmentedHour(segments: Segment[]): number | null {
  if (segments.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of segments) {
    const hour = new Date(s.startedAt).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [hour, count] of counts) {
    if (count > bestCount) {
      best = hour;
      bestCount = count;
    }
  }
  return bestCount > 1 ? best : null;
}

/** Time by category `kind` — never by name, so a renamed category never desyncs a summary. */
export function minutesByKind(
  segments: Segment[],
  categories: Category[],
  now: Date,
): Record<CategoryKind, number> {
  const totals: Record<CategoryKind, number> = { work: 0, rest: 0, upkeep: 0, unclassified: 0 };
  for (const s of segments) {
    const kind = categories.find((c) => c.id === s.categoryId)?.kind ?? "unclassified";
    totals[kind] += minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
  }
  for (const kind of Object.keys(totals) as CategoryKind[]) totals[kind] = Math.round(totals[kind]);
  return totals;
}

export type ProjectMinutes = { project: Project | null; minutes: number };

/**
 * Time by project, through the task each segment is linked to — only
 * task-linked segments count, since an activity was never anyone's project.
 * A task whose project was deleted (or was never assigned one) lands in the
 * `project: null` "No project" bucket, so the total minutes tracked on tasks
 * always adds up.
 */
export function minutesByProject(
  segments: Segment[],
  tasks: Task[],
  projects: Project[],
  now: Date,
): ProjectMinutes[] {
  const totals = new Map<string | null, number>();
  for (const s of segments) {
    if (!s.taskId) continue;
    const task = tasks.find((t) => t.id === s.taskId);
    const projectId = task?.projectId ?? null;
    const minutes = minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
    totals.set(projectId, (totals.get(projectId) ?? 0) + minutes);
  }
  return [...totals.entries()]
    .map(([projectId, minutes]) => ({
      project: projectId ? (projects.find((p) => p.id === projectId) ?? null) : null,
      minutes: Math.round(minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

function localMidnight(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local dates, oldest first, `days` long, ending at endISO (inclusive). */
export function rangeDays(endISO: string, days: number): string[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(endISO, i - (days - 1)));
}

/** Unrounded minutes of one segment that fall on local day `dayISO`. */
function segmentMinutesOnDay(s: Segment, dayISO: string, now: Date): number {
  const from = localMidnight(dayISO).getTime();
  const to = localMidnight(addDays(dayISO, 1)).getTime();
  const start = Math.max(new Date(s.startedAt).getTime(), from);
  const end = Math.min(s.endedAt ? new Date(s.endedAt).getTime() : now.getTime(), to);
  return Math.max(0, (end - start) / 60_000);
}

function rawMinutesByDay(segments: Segment[], endISO: string, days: number, now: Date): number[] {
  return rangeDays(endISO, days).map((d) => segments.reduce((sum, s) => sum + segmentMinutesOnDay(s, d, now), 0));
}

/** Tracked minutes per local calendar day. A segment crossing local midnight is split; a running one counts to `now`. */
export function minutesByDay(segments: Segment[], endISO: string, days: number, now: Date): number[] {
  return rawMinutesByDay(segments, endISO, days, now).map(Math.round);
}

/** Number of segments that START on each day of rangeDays(endISO, days). */
export function sessionsByDay(segments: Segment[], endISO: string, days: number): number[] {
  const counts = new Map<string, number>();
  for (const s of segments) {
    const d = toISODate(new Date(s.startedAt));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return rangeDays(endISO, days).map((d) => counts.get(d) ?? 0);
}

/** This week = Monday of todayISO's week up to now. Last week = the full Monday-Sunday week before it. */
export function weekTotals(segments: Segment[], todayISO: string, now: Date): { thisWeek: number; lastWeek: number } {
  const monday = weekDays(todayISO)[0];
  const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0));
  return {
    thisWeek: sum(rawMinutesByDay(segments, todayISO, daysBetween(monday, todayISO) + 1, now)),
    lastWeek: sum(rawMinutesByDay(segments, addDays(monday, -1), 7, now)),
  };
}

/** Mean of the Monday-Friday entries of a series ending at endISO, counting only weekdays with minutes > 0. */
export function weekdayAverage(series: number[], endISO: string): { average: number; weekdays: number } {
  let total = 0;
  let count = 0;
  series.forEach((minutes, i) => {
    const dow = localMidnight(addDays(endISO, i - (series.length - 1))).getDay();
    if (dow >= 1 && dow <= 5 && minutes > 0) {
      total += minutes;
      count += 1;
    }
  });
  return { average: count === 0 ? 0 : Math.round(total / count), weekdays: count };
}

/** Tracked minutes per taskId (running counts to now), unrounded. */
function trackedByTask(segments: Segment[], now: Date): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of segments) {
    if (!s.taskId) continue;
    totals.set(s.taskId, (totals.get(s.taskId) ?? 0) + minutesBetween(s.startedAt, s.endedAt ?? now.toISOString()));
  }
  return totals;
}

/** How close tracked time came to the estimate, over estimated tasks that have tracked time. */
export function planAccuracy(
  tasks: Task[],
  segments: Segment[],
  now: Date,
): { percent: number | null; overByAvg: number } {
  const tracked = trackedByTask(segments, now);
  const scores: number[] = [];
  const overs: number[] = [];
  for (const t of tasks) {
    const actual = tracked.get(t.id) ?? 0;
    if (!(t.minutes > 0) || actual <= 0) continue;
    scores.push(Math.min(t.minutes, actual) / Math.max(t.minutes, actual));
    if (actual > t.minutes) overs.push(actual - t.minutes);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    percent: scores.length === 0 ? null : Math.round(mean(scores) * 100),
    overByAvg: overs.length === 0 ? 0 : Math.round(mean(overs)),
  };
}

/** planAccuracy per day of the range, using segments that start that day; 0 when no task qualifies. */
export function accuracyByDay(tasks: Task[], segments: Segment[], endISO: string, days: number, now: Date): number[] {
  return rangeDays(endISO, days).map((d) => {
    const day = segments.filter((s) => toISODate(new Date(s.startedAt)) === d);
    return planAccuracy(tasks, day, now).percent ?? 0;
  });
}

export function sessionStats(segments: Segment[], now: Date): { count: number; longest: number } {
  return { count: segments.length, longest: longestStretchMinutes(segments, now) };
}

/** Sum of estimates of non-trashed tasks scheduled in [startISO, endISO] for a project (null = no project). */
export function plannedMinutesForProject(
  tasks: Task[],
  projectId: string | null,
  startISO: string,
  endISO: string,
): number {
  let total = 0;
  for (const t of tasks) {
    if (t.status === "trashed" || t.scheduled === null) continue;
    if (t.scheduled < startISO || t.scheduled > endISO) continue;
    if ((t.projectId ?? null) !== projectId) continue;
    total += t.minutes;
  }
  return total;
}

/** Mean of each consecutive bucket so the result has at most `points` values. */
export function sparkSeries(series: number[], points = 12): number[] {
  if (points < 1 || series.length <= points) return [...series];
  const size = Math.ceil(series.length / points);
  const out: number[] = [];
  for (let i = 0; i < series.length; i += size) {
    const bucket = series.slice(i, i + size);
    out.push(bucket.reduce((x, y) => x + y, 0) / bucket.length);
  }
  return out;
}

export { fmtHours } from "./format";
