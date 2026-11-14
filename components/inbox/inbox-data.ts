import type { Task, TrackingSettings } from "@/lib/types";
import { addDays, daysBetween, toISODate } from "@/lib/parse";
import { isInbox } from "@/lib/today";
import { dayPlan } from "@/lib/day-plan";

export type InboxSort = "oldest" | "newest";
export const SORT_LABEL: Record<InboxSort, string> = { oldest: "Oldest first", newest: "Newest first" };

const DAYS = 12;

function createdDay(task: Task): string {
  return toISODate(new Date(task.createdAt));
}

/** Open undated tasks (lib/today.ts isInbox), sorted by createdAt ascending for "oldest", descending for "newest"; ties keep store order. */
export function inboxTasks(tasks: Task[], todayISO: string, sort: InboxSort): Task[] {
  const dir = sort === "oldest" ? 1 : -1;
  return tasks
    .filter((t) => isInbox(t, todayISO))
    .map((t, i) => ({ t, i, at: Date.parse(t.createdAt) || 0 }))
    .sort((a, b) => dir * (a.at - b.at) || a.i - b.i)
    .map((x) => x.t);
}

/** Whole local days since the task was created, never below 0. */
export function ageDays(task: Task, todayISO: string): number {
  return Math.max(0, daysBetween(createdDay(task), todayISO));
}

/** "Added today", "Added yesterday", "Added N days ago". */
export function ageLabel(task: Task, todayISO: string): string {
  const n = ageDays(task, todayISO);
  if (n === 0) return "Added today";
  if (n === 1) return "Added yesterday";
  return `Added ${n} days ago`;
}

export type InboxGroup = { key: "older" | "week"; label: string; tasks: Task[]; minutes: number };

/** Splits an already sorted list into "Older than a week" (ageDays >= 7) and "This week"; empty groups left out, order follows the list. */
export function groupInbox(sorted: Task[], todayISO: string): InboxGroup[] {
  const groups: InboxGroup[] = [];
  for (const t of sorted) {
    const key: InboxGroup["key"] = ageDays(t, todayISO) >= 7 ? "older" : "week";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: key === "older" ? "Older than a week" : "This week", tasks: [], minutes: 0 };
      groups.push(g);
    }
    g.tasks.push(t);
    g.minutes += t.minutes;
  }
  return groups;
}

export type InboxStats = {
  count: number;
  addedThisWeek: number;
  oldestDays: number | null;
  oldestSince: string | null;
  estimatedMinutes: number;
  noEstimate: number;
  clearedThisWeek: number;
  clearedToday: number;
  addedByDay: number[];
  minutesByDay: number[];
  clearedByDay: number[];
};

export function inboxStats(tasks: Task[], todayISO: string): InboxStats {
  const inbox = tasks.filter((t) => isInbox(t, todayISO));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(todayISO, i - (DAYS - 1)));
  const slot = new Map(days.map((d, i) => [d, i]));

  const addedByDay = new Array<number>(DAYS).fill(0);
  const minutesByDay = new Array<number>(DAYS).fill(0);
  const clearedByDay = new Array<number>(DAYS).fill(0);
  for (const t of tasks) {
    if (t.scheduled !== null) continue;
    const i = slot.get(createdDay(t));
    if (i !== undefined) {
      addedByDay[i] += 1;
      minutesByDay[i] += t.minutes;
    }
    if (t.status === "done" && t.completedAt) {
      const j = slot.get(toISODate(new Date(t.completedAt)));
      if (j !== undefined) clearedByDay[j] += 1;
    }
  }

  let oldest: Task | null = null;
  let oldestAge = -1;
  for (const t of inbox) {
    const a = ageDays(t, todayISO);
    if (a > oldestAge) {
      oldestAge = a;
      oldest = t;
    }
  }

  return {
    count: inbox.length,
    addedThisWeek: inbox.filter((t) => ageDays(t, todayISO) <= 6).length,
    oldestDays: oldest ? oldestAge : null,
    oldestSince: oldest ? createdDay(oldest) : null,
    estimatedMinutes: inbox.reduce((n, t) => n + t.minutes, 0),
    noEstimate: inbox.filter((t) => t.minutes === 0).length,
    clearedThisWeek: clearedByDay.slice(DAYS - 7).reduce((n, v) => n + v, 0),
    clearedToday: clearedByDay[DAYS - 1],
    addedByDay,
    minutesByDay,
    clearedByDay,
  };
}

/** The head sentence, for example "6 tasks with no day yet. The oldest has waited 12 days." */
export function inboxHeadline(stats: InboxStats): string {
  if (stats.count === 0) return "Nothing waiting for a day.";
  const head = `${stats.count} ${stats.count === 1 ? "task" : "tasks"} with no day yet.`;
  const d = stats.oldestDays ?? 0;
  const tail = d === 0 ? "The oldest came in today." : d === 1 ? "The oldest has waited 1 day." : `The oldest has waited ${d} days.`;
  return `${head} ${tail}`;
}

export type FreeSlot = { date: string; start: string; end: string; minutes: number; fits: Task | null };

/** The longest dayPlan free window of each of the next 7 days (today included), first 3 days that have one; each gets the first unused inbox task that fits. */
export function freeThisWeek(
  tasks: Task[],
  inbox: Task[],
  todayISO: string,
  now: Date,
  settings: TrackingSettings | null,
): { slots: FreeSlot[]; totalMinutes: number; provisional: boolean } {
  if (!settings || settings.wakingEndHour - settings.wakingStartHour <= 0) {
    return { slots: [], totalMinutes: 0, provisional: true };
  }
  const used = new Set<string>();
  const slots: FreeSlot[] = [];
  for (let i = 0; i < 7 && slots.length < 3; i++) {
    const date = addDays(todayISO, i);
    let at = now;
    if (i > 0) {
      const [y, m, d] = date.split("-").map(Number);
      at = new Date(y, m - 1, d, settings.wakingStartHour, 0, 0, 0);
    }
    const open = tasks.filter((t) => t.status !== "done" && t.scheduled === date);
    const plan = dayPlan({ open, now: at, endHour: settings.wakingEndHour, runningTaskId: null });
    let best: { start: string; end: string; minutes: number } | null = null;
    for (const b of plan.blocks) {
      if (b.kind === "free" && (!best || b.minutes > best.minutes)) best = b;
    }
    if (!best) continue;
    const win = best;
    const fits = inbox.find((t) => t.minutes > 0 && t.minutes <= win.minutes && !used.has(t.id)) ?? null;
    if (fits) used.add(fits.id);
    slots.push({ date, start: win.start, end: win.end, minutes: win.minutes, fits });
  }
  return { slots, totalMinutes: slots.reduce((n, s) => n + s.minutes, 0), provisional: false };
}
