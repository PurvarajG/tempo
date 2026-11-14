import { fmt, fmtTime, rank } from "./format";
import { isHiddenUntil, rankSuggestions, suggest, type Suggestion } from "./next";
import { addDays, toISODate } from "./parse";
import { DAY_END_HOUR, type Task, type TimeEntry, type TrackingSettings } from "./types";

export type TodayLayout = {
  upNext: Suggestion | null;
  alternatives: Suggestion[];
  committed: Task[];
  couldAlso: Task[];
  carried: Task[];
  done: Task[];
};

/** A multi-day task whose span covers today. */
function spansToday(t: Task, todayISO: string): boolean {
  return (
    t.isComplex &&
    t.scheduled !== null &&
    t.finishDate !== undefined &&
    t.scheduled <= todayISO &&
    todayISO <= t.finishDate
  );
}

export function isPlanned(t: Task, todayISO: string): boolean {
  if (t.status !== "open" || isHiddenUntil(t, todayISO)) return false;
  return t.scheduled === todayISO || spansToday(t, todayISO);
}

export function isCarried(t: Task, todayISO: string): boolean {
  if (t.status !== "open" || isHiddenUntil(t, todayISO)) return false;
  if (t.scheduled === null || t.scheduled >= todayISO) return false;
  return !spansToday(t, todayISO);
}

function byRankThenOrder(a: Task, b: Task): number {
  return rank(a) - rank(b) || a.sortOrder - b.sortOrder;
}

export function layoutToday(
  tasks: Task[],
  todayISO: string,
  now: Date,
  runningTaskId: string | null,
  skipIds?: ReadonlySet<string>,
): TodayLayout {
  const opts = { skipIds };
  const upNext = suggest(tasks, now, runningTaskId, opts);
  const alternatives = rankSuggestions(tasks, now, runningTaskId, opts).slice(1);
  const upId = upNext?.task.id ?? null;

  const committed = tasks
    .filter((t) => t.status === "open" && t.committedOn === todayISO && t.id !== upId)
    .sort(byRankThenOrder);
  const committedIds = new Set(committed.map((t) => t.id));
  const isOther = (t: Task) => t.id !== upId && !committedIds.has(t.id) && t.committedOn !== todayISO;

  const couldAlso = tasks.filter((t) => isPlanned(t, todayISO) && isOther(t)).sort(byRankThenOrder);
  const carried = tasks
    .filter((t) => isCarried(t, todayISO) && isOther(t))
    .sort((a, b) => (a.scheduled ?? "").localeCompare(b.scheduled ?? "") || a.sortOrder - b.sortOrder);
  const done = tasks
    .filter(
      (t) => t.status === "done" && !!t.completedAt && toISODate(new Date(t.completedAt)) === todayISO,
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return { upNext, alternatives, committed, couldAlso, carried, done };
}

export type Capacity = {
  endHour: number;
  endLabel: string;
  minutesLeft: number;
  plannedMinutes: number;
  committedMinutes: number;
  freeMinutes: number;
  dayDone: boolean;
  over: boolean;
};

export function capacity(
  tasks: Task[],
  todayISO: string,
  now: Date,
  settings: Pick<TrackingSettings, "wakingEndHour"> | null,
): Capacity {
  const endHour = settings?.wakingEndHour ?? DAY_END_HOUR;
  const endLabel = fmtTime(`${String(endHour).padStart(2, "0")}:00`);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, 0, 0, 0);
  const minutesLeft = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60_000));
  const dayDone = now.getTime() >= end.getTime();

  let plannedMinutes = 0;
  let committedMinutes = 0;
  for (const t of tasks) {
    if (t.status !== "open") continue;
    const isCommitted = t.committedOn === todayISO;
    if (isCommitted) committedMinutes += t.minutes;
    if (isCommitted || isPlanned(t, todayISO)) plannedMinutes += t.minutes;
  }
  const freeMinutes = Math.max(0, minutesLeft - plannedMinutes);
  return {
    endHour,
    endLabel,
    minutesLeft,
    plannedMinutes,
    committedMinutes,
    freeMinutes,
    dayDone,
    over: !dayDone && plannedMinutes > minutesLeft,
  };
}

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function countPhrase(n: number): string {
  if (n === 1) return "One task";
  return `${n <= 10 ? COUNT_WORDS[n] : n} tasks`;
}

/** How far the planned work overshoots the time left. The Free today KPI and the headline both read this. */
export function overBy(cap: Capacity): number {
  return Math.max(0, cap.plannedMinutes - cap.minutesLeft);
}

export function headline(openCount: number, cap: Capacity): string {
  if (cap.dayDone) return "Day's done.";
  if (openCount <= 0) return "Nothing left for today.";
  const count = countPhrase(openCount);
  if (cap.over) return `${count} left, over by ${fmt(overBy(cap))} before ${cap.endLabel}.`;
  return `${count} left, and ${fmt(cap.freeMinutes)} still free before ${cap.endLabel}.`;
}

/** The one Inbox rule: open, no day yet, and not hidden until a later date. */
export function isInbox(t: Task, todayISO: string): boolean {
  return t.status === "open" && t.scheduled === null && !isHiddenUntil(t, todayISO);
}

export function inboxCount(tasks: Task[], todayISO: string): number {
  return tasks.filter((t) => isInbox(t, todayISO)).length;
}

function dayRange(endISO: string, days: number): string[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(endISO, i - (days - 1)));
}

export function plannedByDay(tasks: Task[], endISO: string, days: number): number[] {
  const totals = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "trashed" || t.scheduled === null) continue;
    totals.set(t.scheduled, (totals.get(t.scheduled) ?? 0) + t.minutes);
  }
  return dayRange(endISO, days).map((d) => totals.get(d) ?? 0);
}

export function trackedByDay(entries: TimeEntry[], endISO: string, days: number): number[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.endedAt || e.minutes === undefined) continue;
    const d = toISODate(new Date(e.startedAt));
    totals.set(d, (totals.get(d) ?? 0) + e.minutes);
  }
  return dayRange(endISO, days).map((d) => totals.get(d) ?? 0);
}

export function weekDays(todayISO: string): string[] {
  const [y, m, d] = todayISO.split("-").map(Number);
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(todayISO, i - sinceMonday));
}

export function isPastWrap(now: Date, wrapHour: number): boolean {
  return now.getHours() >= wrapHour;
}
