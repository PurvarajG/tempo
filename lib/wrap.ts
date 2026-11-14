import { fmtHours, rank } from "./format";
import { isHiddenUntil } from "./next";
import { addDays, daysBetween, toISODate } from "./parse";
import type { Task, TimeEntry } from "./types";

/** Open tasks untouched for this many days show under "Gone quiet". */
export const QUIET_AFTER_DAYS = 14;

function startedOn(e: TimeEntry, dayISO: string): boolean {
  return toISODate(new Date(e.startedAt)) === dayISO;
}

function isStopped(e: TimeEntry): boolean {
  return !!e.endedAt && e.minutes !== undefined && e.minutes !== null;
}

/** Tasks with status 'done' whose completedAt falls on dayISO, oldest completion first. */
export function doneOn(tasks: Task[], dayISO: string): Task[] {
  return tasks
    .filter(
      (t) =>
        t.status === "done" &&
        !!t.completedAt &&
        toISODate(new Date(t.completedAt)) === dayISO,
    )
    .sort(
      (a, b) =>
        new Date(a.completedAt as string).getTime() -
        new Date(b.completedAt as string).getTime(),
    );
}

/** Minutes of stopped entries that started on dayISO, plus the running entry's elapsed whole minutes. */
export function focusedMinutes(
  entries: TimeEntry[],
  dayISO: string,
  running?: TimeEntry | null,
  now?: Date,
): number {
  let total = 0;
  for (const e of entries) {
    if (isStopped(e) && startedOn(e, dayISO)) total += e.minutes as number;
  }
  if (running && now && startedOn(running, dayISO)) {
    const ms = now.getTime() - new Date(running.startedAt).getTime();
    total += Math.max(0, Math.floor(ms / 60_000));
  }
  return total;
}

/** The one calm line for the top of the wrap page. */
export function calmLine(doneCount: number, focused: number): string {
  if (doneCount <= 0 && focused <= 0) return "Nothing marked done today.";
  if (doneCount <= 0) return `${fmtHours(focused)} focused, nothing marked done.`;
  if (focused <= 0) return `${doneCount} done.`;
  return `${doneCount} done, ${fmtHours(focused)} focused.`;
}

export type EstimateMiss = { task: Task; planned: number; actual: number; over: number };

/** The biggest gaps between estimate and tracked time for tasks touched on dayISO. */
export function estimateMisses(
  tasks: Task[],
  entries: TimeEntry[],
  dayISO: string,
  limit = 3,
): EstimateMiss[] {
  const actualById = new Map<string, number>();
  const startedToday = new Set<string>();
  for (const e of entries) {
    if (!isStopped(e)) continue;
    actualById.set(e.taskId, (actualById.get(e.taskId) ?? 0) + (e.minutes as number));
    if (startedOn(e, dayISO)) startedToday.add(e.taskId);
  }
  const doneToday = new Set(doneOn(tasks, dayISO).map((t) => t.id));

  const out: EstimateMiss[] = [];
  for (const task of tasks) {
    if (!doneToday.has(task.id) && !startedToday.has(task.id)) continue;
    const planned = task.minutes;
    const actual = actualById.get(task.id) ?? 0;
    if (!(planned > 0) || !(actual > 0)) continue;
    const over = actual - planned;
    if (over === 0) continue;
    out.push({ task, planned, actual, over });
  }
  out.sort(
    (a, b) => Math.abs(b.over) - Math.abs(a.over) || a.task.title.localeCompare(b.task.title),
  );
  return out.slice(0, Math.max(0, limit));
}

function byRankThenOrder(a: Task, b: Task): number {
  return rank(a) - rank(b) || a.sortOrder - b.sortOrder;
}

/** Wrap's Tomorrow list: what is planned for tomorrow, and what Today will show as carried over. */
export function tomorrowTasks(
  tasks: Task[],
  todayISO: string,
): { planned: Task[]; carried: Task[] } {
  const tomorrow = addDays(todayISO, 1);
  const planned: Task[] = [];
  const carried: Task[] = [];
  for (const t of tasks) {
    if (t.status !== "open" || t.scheduled === null) continue;
    if (isHiddenUntil(t, tomorrow)) continue;
    if (t.scheduled === tomorrow) {
      planned.push(t);
      continue;
    }
    if (t.scheduled > todayISO) continue;
    const spansTomorrow =
      t.isComplex && t.finishDate !== undefined && t.finishDate >= tomorrow;
    if (spansTomorrow) continue;
    carried.push(t);
  }
  return { planned: planned.sort(byRankThenOrder), carried: carried.sort(byRankThenOrder) };
}

/** weeklyResetDay is 0 (Sunday) to 6, as stored in settings. */
export function isResetDay(todayISO: string, weeklyResetDay: number): boolean {
  const [y, m, d] = todayISO.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === weeklyResetDay;
}

/** Local YYYY-MM-DD of the latest sign of life on a task. */
export function lastTouched(task: Task, entries: TimeEntry[]): string {
  const stamps: string[] = [task.createdAt];
  if (task.stageEnteredAt) stamps.push(task.stageEnteredAt);
  if (task.completedAt) stamps.push(task.completedAt);
  for (const e of entries) {
    if (e.taskId !== task.id) continue;
    stamps.push(e.startedAt);
    if (e.endedAt) stamps.push(e.endedAt);
  }
  let best = "";
  for (const s of stamps) {
    const day = toISODate(new Date(s));
    if (day > best) best = day;
  }
  return best;
}

/** Open tasks untouched for `days` or more days, oldest first. */
export function goneQuiet(
  tasks: Task[],
  entries: TimeEntry[],
  todayISO: string,
  days: number = QUIET_AFTER_DAYS,
): Task[] {
  const rows: { task: Task; touched: string }[] = [];
  for (const task of tasks) {
    if (task.status !== "open" || isHiddenUntil(task, todayISO)) continue;
    const touched = lastTouched(task, entries);
    if (daysBetween(touched, todayISO) >= days) rows.push({ task, touched });
  }
  rows.sort(
    (a, b) =>
      (a.touched < b.touched ? -1 : a.touched > b.touched ? 1 : 0) ||
      a.task.title.localeCompare(b.task.title),
  );
  return rows.map((r) => r.task);
}

export type WeekNumbers = { done: number; focusedMinutes: number; accuracy: number | null };

/** Three calm numbers for the last 7 days ending today. */
export function weekNumbers(tasks: Task[], entries: TimeEntry[], todayISO: string): WeekNumbers {
  const first = addDays(todayISO, -6);
  const inWindow = (iso: string) => iso >= first && iso <= todayISO;

  let done = 0;
  for (const t of tasks) {
    if (t.status === "done" && t.completedAt && inWindow(toISODate(new Date(t.completedAt)))) {
      done += 1;
    }
  }

  let focused = 0;
  const trackedById = new Map<string, number>();
  for (const e of entries) {
    if (!isStopped(e) || !inWindow(toISODate(new Date(e.startedAt)))) continue;
    focused += e.minutes as number;
    trackedById.set(e.taskId, (trackedById.get(e.taskId) ?? 0) + (e.minutes as number));
  }

  const ratios: number[] = [];
  for (const t of tasks) {
    const actual = trackedById.get(t.id) ?? 0;
    if (!(t.minutes > 0) || !(actual > 0)) continue;
    ratios.push(Math.min(t.minutes, actual) / Math.max(t.minutes, actual));
  }
  const accuracy = ratios.length
    ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100)
    : null;

  return { done, focusedMinutes: focused, accuracy };
}
